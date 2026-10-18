/** What every format is built from: exact objects, lists, numbers and text, and their check. */

import * as v from "valibot";

/** Thrown when an input breaks its format. Its message names every problem by its path. */
export class FormatError extends Error {
	override name = "FormatError";
}

/** An object reports a wrong type and a missing key through one message. */
function objectProblem(issue: v.ObjectIssue): string {
	return issue.expected === "Object" ? "must be an object" : "missing";
}

/**
 * An object with these keys and no others. A list is not an object. Every unknown key is
 * reported, `__proto__` included, which valibot's own object schemas skip or stop after.
 */
export function exact<E extends v.ObjectEntries>(entries: E) {
	return v.pipe(
		v.custom<unknown>((input) => !Array.isArray(input), "must be an object"),
		v.intersect([
			v.object(entries, objectProblem),
			v.pipe(
				v.unknown(),
				v.rawCheck(({ dataset, addIssue }) => {
					if (typeof dataset.value !== "object" || dataset.value === null)
						return;
					const input = dataset.value as { [key: string]: unknown };
					for (const key of Object.keys(input)) {
						if (Object.hasOwn(entries, key)) continue;
						const value = input[key];
						addIssue({
							message: "unknown key",
							path: [{ type: "object", origin: "key", input, key, value }],
						});
					}
				}),
			),
		]),
	);
}

export const Integer = v.pipe(
	v.number("must be a number"),
	v.integer("must be an integer"),
);

export const Text = v.string("must be text");

export function list<T extends v.GenericSchema>(item: T) {
	return v.array(item, "must be a list");
}

/** How `parse` writes a problem's path. */
export interface Naming {
	/** What starts every path, such as `options`. */
	readonly prefix?: string;
	/** What a problem with the whole input is called where no prefix starts it, such as `gel`. */
	readonly name?: string;
}

/**
 * Write an issue's path as `features[3].segments[0].end`, after the prefix if there is one.
 * An empty path is the prefix, or else the name.
 */
function pathOf(
	issue: v.BaseIssue<unknown>,
	{ prefix = "", name = "input" }: Naming = {},
): string {
	let path = prefix;
	for (const { key } of issue.path ?? []) {
		path +=
			typeof key === "number" ? `[${key}]` : `${path ? "." : ""}${String(key)}`;
	}
	return path || name;
}

/** Return `input` as `schema` types it, or throw one FormatError naming every problem. */
export function parse<S extends v.GenericSchema>(
	schema: S,
	input: unknown,
	naming: Naming = {},
): v.InferOutput<S> {
	const result = v.safeParse(schema, input);
	if (result.success) return result.output;
	throw new FormatError(
		result.issues
			.map((issue) => `${pathOf(issue, naming)}: ${issue.message}`)
			.join("\n"),
	);
}
