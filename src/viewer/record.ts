/** The record format: what a caller hands the viewer. Its types come from these schemas. */

import * as v from "valibot";

/** Thrown when a record breaks the format. Its message names every problem by its path. */
export class FormatError extends Error {
	override name = "FormatError";
}

/** A strict object reports a wrong type, a missing key and an unknown key through one message. */
function objectProblem(issue: v.StrictObjectIssue): string {
	if (issue.expected === "never") return "unknown key";
	return issue.expected === "Object" ? "must be an object" : "missing";
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

/** A single base: its 0-based index. */
export function base({ length }: Bounds) {
	return v.pipe(
		Integer,
		v.minValue(0, "must be 0 or more"),
		v.ltValue(length, `must be less than the record's length, ${length}`),
	);
}

/** A point between two bases: the number of bases before it. */
export function point({ length, circular }: Bounds) {
	return v.pipe(
		Integer,
		v.minValue(0, "must be 0 or more"),
		circular
			? v.ltValue(
					length,
					`must be less than the record's length, ${length}: on a circular record that point is 0`,
				)
			: v.maxValue(length, `must be at most the record's length, ${length}`),
	);
}

/**
 * A span `{start, end}`, 0-based and half-open. On a circular record, `end` may pass the
 * length to run across the origin, for at most one turn.
 */
export function span(bounds: Bounds) {
	const { length, circular } = bounds;
	return v.pipe(
		v.strictObject({ start: base(bounds), end: Integer }, objectProblem),
		v.forward(
			v.check(({ start, end }) => start < end, "must be greater than start"),
			["end"],
		),
		v.forward(
			circular
				? v.check(
						({ start, end }) => end - start <= length,
						`must be at most start + ${length}, one turn of the record`,
					)
				: v.check(
						({ end }) => end <= length,
						`must be at most the record's length, ${length}`,
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

const RecordSchema = v.strictObject(
	{
		name: v.string("must be text"),
		circular: v.boolean("must be true or false"),
		bases: Bases,
	},
	objectProblem,
);

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
export function parse<const S extends v.GenericSchema>(
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
