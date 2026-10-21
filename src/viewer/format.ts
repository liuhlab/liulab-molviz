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
 * An object that `schema` checks and that is not a list, with a problem `keyProblem` finds in a
 * key reported at that key. Every key is checked, `__proto__` included, which valibot's own
 * object and record schemas skip or stop after.
 */
export function keyed<S extends v.GenericSchema>(
	schema: S,
	keyProblem: (key: string) => string | undefined,
) {
	return v.pipe(
		v.custom<unknown>((input) => !Array.isArray(input), "must be an object"),
		v.intersect([
			schema,
			v.pipe(
				v.unknown(),
				v.rawCheck(({ dataset, addIssue }) => {
					if (typeof dataset.value !== "object" || dataset.value === null)
						return;
					const input = dataset.value as { [key: string]: unknown };
					for (const key of Object.keys(input)) {
						const message = keyProblem(key);
						if (message === undefined) continue;
						const value = input[key];
						addIssue({
							message,
							path: [{ type: "object", origin: "key", input, key, value }],
						});
					}
				}),
			),
		]),
	);
}

/** An object with these keys and no others. */
export function exact<E extends v.ObjectEntries>(entries: E) {
	return keyed(v.object(entries, objectProblem), (key) =>
		Object.hasOwn(entries, key) ? undefined : "unknown key",
	);
}

export const Integer = v.pipe(
	v.number("must be a number"),
	v.integer("must be an integer"),
);

export const PositiveInteger = v.pipe(
	Integer,
	v.minValue(1, "must be 1 or more"),
);

export const Text = v.string("must be text");

/** `name` as a name given in an input matches, whatever its case. */
export function folded(name: string): string {
	return name.toLowerCase();
}

export function list<T extends v.GenericSchema>(item: T) {
	return v.array(item, "must be a list");
}

/** One of `values`, with a message that lists them, text in quotes. */
export function oneOf<const T extends readonly (number | string)[]>(values: T) {
	const shown = values.map((value) => JSON.stringify(value));
	const last = shown.pop();
	const listed = shown.length ? `${shown.join(", ")} or ${last}` : last;
	return v.picklist(values, `must be ${listed}`);
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

/** A problem in an input: its path, and what is wrong there. */
export interface Problem {
	readonly path: string;
	readonly message: string;
}

/** An input as its schema types it, or every problem in it. */
export type Parsed<T> =
	| { readonly output: T }
	| { readonly problems: readonly Problem[] };

/** `input` as `schema` types it, or every problem in it. */
export function parsed<S extends v.GenericSchema>(
	schema: S,
	input: unknown,
	naming: Naming = {},
): Parsed<v.InferOutput<S>> {
	const result = v.safeParse(schema, input);
	if (result.success) return { output: result.output };
	return {
		problems: result.issues.map((issue) => ({
			path: pathOf(issue, naming),
			message: issue.message,
		})),
	};
}

/** Return the output, or throw one FormatError naming each problem on a line of its own. */
export function orThrow<T>(result: Parsed<T>): T {
	if ("output" in result) return result.output;
	throw new FormatError(
		result.problems
			.map(({ path, message }) => `${path}: ${message}`)
			.join("\n"),
	);
}

/** Return `input` as `schema` types it, or throw one FormatError naming every problem. */
export function parse<S extends v.GenericSchema>(
	schema: S,
	input: unknown,
	naming: Naming = {},
): v.InferOutput<S> {
	return orThrow(parsed(schema, input, naming));
}
