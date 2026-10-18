/** The record format: what a caller hands the viewer. Its types come from these schemas. */

import * as v from "valibot";

/** Thrown when a record breaks the format. Its message names every problem by its path. */
export class FormatError extends Error {
	override name = "FormatError";
}

/** An object reports a wrong type and a missing key through one message. */
function objectProblem(issue: v.ObjectIssue): string {
	return issue.expected === "Object" ? "must be an object" : "missing";
}

/**
 * An object with these keys and no others. Every unknown key is reported, `__proto__`
 * included, which valibot's own object schemas skip or stop after.
 */
function exact<E extends v.ObjectEntries>(entries: E) {
	return v.intersect([
		v.object(entries, objectProblem),
		v.pipe(
			v.unknown(),
			v.rawCheck(({ dataset, addIssue }) => {
				if (typeof dataset.value !== "object" || dataset.value === null) return;
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
	]);
}

/** What a coordinate is checked against: its record's length, and whether it is circular. */
export interface Bounds {
	readonly length: number;
	readonly circular: boolean;
}

const Integer = v.pipe(
	v.number("must be a number"),
	v.integer("must be an integer"),
);

const NonNegative = v.pipe(Integer, v.minValue(0, "must be 0 or more"));

function belowLength(
	length: number,
	reason = "",
): v.LtValueAction<number, number, string> {
	return v.ltValue(
		length,
		`must be less than the record's length, ${length}${reason}`,
	);
}

function atMostLength(
	length: number,
): v.MaxValueAction<number, number, string> {
	return v.maxValue(length, `must be at most the record's length, ${length}`);
}

/** A single base: its 0-based index. */
export function base({ length }: Bounds) {
	return v.pipe(NonNegative, belowLength(length));
}

/** A point between two bases: the number of bases before it. */
export function point({ length, circular }: Bounds) {
	return v.pipe(
		NonNegative,
		circular
			? belowLength(length, ": on a circular record that point is 0")
			: atMostLength(length),
	);
}

/**
 * A span `{start, end}`, 0-based and half-open. On a circular record, `end` may pass the
 * length to run across the origin, for at most one turn.
 */
export function span(bounds: Bounds) {
	const { length, circular } = bounds;
	return v.pipe(
		exact({
			start: base(bounds),
			end: circular ? Integer : v.pipe(Integer, atMostLength(length)),
		}),
		v.forward(
			v.check(({ start, end }) => start < end, "must be greater than start"),
			["end"],
		),
		v.forward(
			v.check(
				({ start, end }) => !circular || end - start <= length,
				`must be at most start + ${length}, one turn of the record`,
			),
			["end"],
		),
	);
}

const NOT_IUPAC = /[^ACGTURYSWKMBDHVN]/i;

const Bases = v.pipe(
	v.string("must be text"),
	v.nonEmpty("must hold at least one base"),
	v.check(
		(bases) => !NOT_IUPAC.test(bases),
		({ input }) => {
			const at = input.search(NOT_IUPAC);
			return `has "${input[at]}" at index ${at}, which is not an IUPAC nucleotide letter`;
		},
	),
);

const RecordSchema = exact({
	name: v.string("must be text"),
	circular: v.boolean("must be true or false"),
	bases: Bases,
});

/** One DNA molecule as a caller hands it over. */
export type Record = v.InferOutput<typeof RecordSchema>;

/** Write an issue's path as `features[3].segments[0].end`. */
function pathOf(issue: v.BaseIssue<unknown>): string {
	let path = "";
	for (const { key } of issue.path ?? []) {
		path +=
			typeof key === "number" ? `[${key}]` : `${path ? "." : ""}${String(key)}`;
	}
	return path || "record";
}

/** Return `input` as `schema` types it, or throw one FormatError naming every problem. */
export function parse<S extends v.GenericSchema>(
	schema: S,
	input: unknown,
): v.InferOutput<S> {
	const result = v.safeParse(schema, input);
	if (result.success) return result.output;
	throw new FormatError(
		result.issues
			.map((issue) => `${pathOf(issue)}: ${issue.message}`)
			.join("\n"),
	);
}

/** Return `input` as a typed record, or throw one FormatError naming every problem. */
export function check(input: unknown): Record {
	return parse(RecordSchema, input);
}
