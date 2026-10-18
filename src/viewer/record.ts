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

type Key = string | number;

/** A problem found by a `rule`: the keys to the part it concerns, and the message. */
type Problem = readonly [keys: readonly Key[], message: string];

/**
 * A rule across the parts of a well-formed value, which reports each problem at the part it
 * concerns.
 */
function rule<T>(find: (value: T) => Iterable<Problem>) {
	return v.rawCheck<T>(({ dataset, addIssue }) => {
		if (!dataset.typed) return;
		for (const [keys, message] of find(dataset.value)) {
			const path: v.UnknownPathItem[] = [];
			let input: unknown = dataset.value;
			for (const key of keys) {
				const value = (input as { [key: Key]: unknown })[key];
				path.push({ type: "unknown", origin: "value", input, key, value });
				input = value;
			}
			addIssue({ message, path: path as [v.UnknownPathItem] });
		}
	});
}

/** The keys of a span. A kind that holds a span spreads these into its own, then adds `spanRule`. */
function spanKeys(bounds: Bounds) {
	const { length, circular } = bounds;
	return {
		start: base(bounds),
		end: circular ? Integer : v.pipe(Integer, atMostLength(length)),
	};
}

/** What a span's `start` and `end` keep between them. */
function spanRule<T extends { start: number; end: number }>({
	length,
	circular,
}: Bounds) {
	return rule<T>(function* ({ start, end }) {
		if (start >= end) yield [["end"], "must be greater than start"];
		if (circular && end - start > length) {
			yield [
				["end"],
				`must be at most start + ${length}, one turn of the record`,
			];
		}
	});
}

/**
 * A span `{start, end}`, 0-based and half-open. On a circular record, `end` may pass the
 * length to run across the origin, for at most one turn.
 */
export function span(bounds: Bounds) {
	return v.pipe(exact(spanKeys(bounds)), spanRule(bounds));
}

/** A record's length is unbounded where a record cannot say how long it is. */
const UNBOUNDED = Number.POSITIVE_INFINITY;

const Text = v.string("must be text");

const Color = v.pipe(
	Text,
	v.regex(/^#[0-9a-f]{6}$/i, "must be a colour written #rrggbb"),
);

/** Text holding none of the characters `not` matches, which are not `what`. */
function only(not: RegExp, what: string) {
	return v.check<string, (issue: v.CheckIssue<string>) => string>(
		(text) => !not.test(text),
		({ input }) => {
			const at = input.search(not);
			return `has "${input[at]}" at index ${at}, which is not ${what}`;
		},
	);
}

const Bases = v.pipe(
	Text,
	v.nonEmpty("must hold at least one base"),
	only(/[^ACGTURYSWKMBDHVN]/i, "an IUPAC nucleotide letter"),
);

/** One letter per codon, `*` for a stop. */
const Translation = v.pipe(
	Text,
	v.nonEmpty("must hold at least one letter"),
	only(/[^A-Z*]/, "a capital letter or *"),
);

function segment(bounds: Bounds) {
	return v.pipe(
		exact({ ...spanKeys(bounds), color: v.optional(Color) }),
		spanRule(bounds),
	);
}

/**
 * A feature's segments, in ascending order of start. On a circular record a later segment may
 * start past the length, counted on past the origin, within one turn from the first.
 */
function segments(bounds: Bounds) {
	const { length, circular } = bounds;
	const later = circular ? { length: UNBOUNDED, circular } : bounds;
	return v.pipe(
		v.array(v.unknown(), "must be a list"),
		v.minLength(1, "must hold at least one segment"),
		v.tupleWithRest([segment(bounds)], segment(later)),
		rule(function* (segments) {
			for (let i = 1; i < segments.length; i++) {
				if (segments[i].start <= segments[i - 1].start) {
					yield [
						[i, "start"],
						"must be greater than the previous segment's start",
					];
				}
			}
			const last = segments.length - 1;
			if (last > 0 && segments[last].end - segments[0].start > length) {
				yield [
					[last, "end"],
					`must be at most segments[0].start + ${length}, one turn of the record`,
				];
			}
		}),
	);
}

/** A feature's translation fits the bases its segments hold from `codon_start`, 1 by default. */
function feature(bounds: Bounds) {
	return v.pipe(
		exact({
			name: Text,
			type: Text,
			strand: v.picklist([1, -1, 0, 2], "must be 1, -1, 0 or 2"),
			segments: segments(bounds),
			color: v.optional(Color),
			translation: v.optional(Translation),
			codon_start: v.optional(v.picklist([1, 2, 3], "must be 1, 2 or 3")),
		}),
		rule(function* ({ segments, translation, codon_start }) {
			if (translation === undefined) {
				if (codon_start !== undefined) {
					yield [["codon_start"], "must come with a translation"];
				}
				return;
			}
			// A segment that is empty or reversed has already been reported.
			if (segments.some(({ start, end }) => start >= end)) return;
			const width = segments.reduce(
				(sum, { start, end }) => sum + end - start,
				0,
			);
			const held = width - ((codon_start ?? 1) - 1);
			const needed = 3 * translation.length;
			if (needed > held) {
				yield [
					["translation"],
					`has ${translation.length} letters, ${needed} bases, more than the ${held} the segments hold from codon_start`,
				];
			}
		}),
	);
}

/**
 * A primer's site spans only the bases that anneal, so it is no wider than the primer. Each
 * mismatch is a base inside its site.
 */
function primer(bounds: Bounds) {
	const { length, circular } = bounds;
	const site = v.pipe(
		exact({
			...spanKeys(bounds),
			strand: v.picklist([1, -1], "must be 1 or -1"),
			mismatches: v.optional(v.array(base(bounds), "must be a list")),
		}),
		spanRule(bounds),
		rule(function* ({ start, end, mismatches = [] }) {
			for (const [i, at] of mismatches.entries()) {
				// A site across the origin holds its bases after the origin as `at + length`.
				// Where the length is unknown, any base before the site may be one of them.
				const after =
					length === UNBOUNDED
						? at < start
						: start <= at + length && at + length < end;
				const inside = (start <= at && at < end) || (circular && after);
				if (!inside) yield [["mismatches", i], "must be inside its site"];
			}
		}),
	);
	return v.pipe(
		exact({
			name: Text,
			bases: Bases,
			sites: v.array(site, "must be a list"),
		}),
		rule(function* ({ bases, sites }) {
			for (const [i, { start, end }] of sites.entries()) {
				if (end - start > bases.length) {
					yield [
						["sites", i, "end"],
						`must be at most start + ${bases.length}, the primer's length`,
					];
				}
			}
		}),
	);
}

/**
 * A cut: its recognition sequence as a span, and where it cuts each strand. On a linear record
 * the bottom-strand cut, `at + stagger`, lies within the record.
 */
function cut(bounds: Bounds) {
	const { length, circular } = bounds;
	return v.pipe(
		exact({
			enzyme: Text,
			...spanKeys(bounds),
			at: point(bounds),
			stagger: Integer,
		}),
		spanRule(bounds),
		rule(function* ({ at, stagger }) {
			if (circular) return;
			const problem = "must keep at + stagger, the bottom-strand cut,";
			if (at + stagger < 0) yield [["stagger"], `${problem} at 0 or more`];
			if (at + stagger > length) {
				yield [
					["stagger"],
					`${problem} at most the record's length, ${length}`,
				];
			}
		}),
	);
}

function insertion(bounds: Bounds) {
	return exact({
		name: Text,
		at: point(bounds),
		length: v.pipe(Integer, v.minValue(1, "must be 1 or more")),
		color: v.optional(Color),
	});
}

function recordSchema(bounds: Bounds) {
	return exact({
		name: Text,
		circular: v.boolean("must be true or false"),
		bases: Bases,
		features: v.optional(v.array(feature(bounds), "must be a list")),
		primers: v.optional(v.array(primer(bounds), "must be a list")),
		cuts: v.optional(v.array(cut(bounds), "must be a list")),
		insertions: v.optional(v.array(insertion(bounds), "must be a list")),
	});
}

/** One DNA molecule as a caller hands it over. */
export type Record = v.InferOutput<ReturnType<typeof recordSchema>>;

/**
 * What a record's coordinates are checked against. Where `bases` or `circular` is malformed
 * the length is unbounded, so only the rules that need no length apply, and a malformed
 * `circular` reads as circular, the shape with the looser rules.
 */
function boundsOf(input: unknown): Bounds {
	const { bases, circular } = (
		typeof input === "object" && input !== null ? input : {}
	) as { bases?: unknown; circular?: unknown };
	if (v.is(Bases, bases) && typeof circular === "boolean") {
		return { length: bases.length, circular };
	}
	return { length: UNBOUNDED, circular: circular !== false };
}

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
	return parse(recordSchema(boundsOf(input)), input);
}
