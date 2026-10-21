/** The record format: what a caller hands the viewer. Its types come from these schemas. */

import * as v from "valibot";
import { exact, Integer, list, oneOf, parse, Text } from "./format";

/** What a coordinate is checked against: its record's length, and whether it is circular. */
export interface Bounds {
	readonly length: number;
	readonly circular: boolean;
}

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
export function rule<T>(find: (value: T) => Iterable<Problem>) {
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

/** An `end` more than one turn past `start`, which `from` names, reported at `keys`. */
function* pastOneTurn(
	keys: readonly Key[],
	from: string,
	start: number,
	end: number,
	length: number,
): Generator<Problem> {
	if (end - start > length) {
		yield [keys, `must be at most ${from} + ${length}, one turn of the record`];
	}
}

/**
 * The keys of a span. A kind that holds a span spreads these into its own, then adds
 * `spanRule`.
 */
function spanKeys(bounds: Bounds) {
	const { length, circular } = bounds;
	return {
		start: base(bounds),
		end: circular ? Integer : v.pipe(Integer, atMostLength(length)),
	};
}

/** What a span's `start` and `end` keep between them. */
function spanRule<T extends { start: number; end: number }>(bounds: Bounds) {
	return rule<T>(({ start, end }) => spanProblems(bounds, start, end));
}

function* spanProblems(
	{ length, circular }: Bounds,
	start: number,
	end: number,
): Generator<Problem> {
	if (start >= end) yield [["end"], "must be greater than start"];
	if (circular) yield* pastOneTurn(["end"], "start", start, end, length);
}

/**
 * A span `{start, end}`, 0-based and half-open. On a circular record, `end` may pass the
 * length to run across the origin, for at most one turn.
 */
export function span(bounds: Bounds) {
	return v.pipe(exact(spanKeys(bounds)), spanRule(bounds));
}

export type Span = v.InferOutput<ReturnType<typeof span>>;

/** A record's length is unbounded where a record cannot say how long it is. */
const UNBOUNDED = Number.POSITIVE_INFINITY;

const Color = v.pipe(
	Text,
	v.regex(/^#[0-9a-f]{6}$/i, "must be a color written #rrggbb"),
);

/** Text over an alphabet: no character matches `outside`, and `letter` names the alphabet's. */
function overAlphabet(outside: RegExp, letter: string) {
	return v.check<string, (issue: v.CheckIssue<string>) => string>(
		(text) => !outside.test(text),
		({ input }) => {
			const at = input.search(outside);
			return `has "${input[at]}" at index ${at}, which is not ${letter}`;
		},
	);
}

const Nucleotides = overAlphabet(
	/[^ACGTURYSWKMBDHVN]/i,
	"an IUPAC nucleotide letter",
);

const Bases = v.pipe(
	Text,
	v.nonEmpty("must hold at least one base"),
	Nucleotides,
);

/** One letter per codon, `*` for a stop. */
const Translation = v.pipe(
	Text,
	v.nonEmpty("must hold at least one letter"),
	overAlphabet(/[^A-Z*]/, "a capital letter or *"),
);

function segment(bounds: Bounds) {
	return v.pipe(
		exact({ ...spanKeys(bounds), color: v.optional(Color) }),
		spanRule(bounds),
	);
}

/**
 * Whether `segment`, the one after `before` in a feature, runs on from a linear record's start:
 * the feature ran off the end between them.
 */
export function runsOnFromStart(
	before: Span,
	segment: Span,
	{ circular }: Bounds,
): boolean {
	return !circular && segment.start < before.start;
}

/**
 * A feature's segments, in ascending order of start. On a circular record a later segment may
 * start past the length, counted on past the origin, within one turn from the first. On a
 * linear record one segment may start lower than the one before, where the feature runs off
 * the end and on from the start.
 */
function segments(bounds: Bounds) {
	const { length, circular } = bounds;
	const laterBounds = circular ? { length: UNBOUNDED, circular } : bounds;
	return v.pipe(
		list(v.unknown()),
		v.minLength(1, "must hold at least one segment"),
		v.tupleWithRest([segment(bounds)], segment(laterBounds)),
		rule(function* (segments) {
			const first = segments[0].start;
			let crossed = false;
			for (let i = 1; i < segments.length; i++) {
				const { start, end } = segments[i];
				const previous = segments[i - 1].start;
				const runsOn = runsOnFromStart(segments[i - 1], segments[i], bounds);
				if (runsOn && !crossed) {
					crossed = true;
				} else if (runsOn) {
					yield [
						[i, "start"],
						"must be greater than the previous segment's start: a feature runs off a linear record's end once",
					];
				} else if (start <= previous) {
					yield [
						[i, "start"],
						"must be greater than the previous segment's start",
					];
				}
				// Ends need not ascend, so each is held to the first start: at most it on a linear
				// record once the feature has run off the end, within one turn past it on a circle.
				if (crossed && end > first) {
					yield [
						[i, "end"],
						`must be at most segments[0].start, ${first}, once the feature has run off the end`,
					];
				}
				if (circular) {
					yield* pastOneTurn(
						[i, "end"],
						"segments[0].start",
						first,
						end,
						length,
					);
				}
			}
		}),
	);
}

/** A feature's strand: 1 forward, -1 reverse, 0 none, 2 both. */
const STRANDS = [1, -1, 0, 2] as const;

/** A feature's translation fits the bases its segments hold from `codon_start`, 1 by default. */
function feature(bounds: Bounds) {
	return v.pipe(
		exact({
			name: Text,
			type: Text,
			strand: oneOf(STRANDS),
			segments: segments(bounds),
			color: v.optional(Color),
			translation: v.optional(Translation),
			codon_start: v.optional(oneOf([1, 2, 3])),
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
			strand: oneOf([1, -1]),
			mismatches: v.optional(list(base(bounds))),
		}),
		spanRule(bounds),
		rule(function* ({ start, end, mismatches = [] }) {
			for (const [i, at] of mismatches.entries()) {
				// A site across the origin holds its bases after the origin as `at + length`.
				// Where the length is unknown, any base before the site may be one of them.
				const insidePastOrigin =
					length === UNBOUNDED
						? at < start
						: start <= at + length && at + length < end;
				const inside =
					(start <= at && at < end) || (circular && insidePastOrigin);
				if (!inside) yield [["mismatches", i], "must be inside its site"];
			}
		}),
	);
	return v.pipe(
		exact({
			name: Text,
			bases: Bases,
			sites: list(site),
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
			// An `at` out of range has already been reported.
			if (circular || at < 0 || at > length) return;
			const mustKeep = "must keep at + stagger, the bottom-strand cut,";
			if (at + stagger < 0) yield [["stagger"], `${mustKeep} at 0 or more`];
			if (at + stagger > length) {
				yield [
					["stagger"],
					`${mustKeep} at most the record's length, ${length}`,
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

/** One sequencing result, over the bases it trusts. */
function read(bounds: Bounds) {
	return v.pipe(
		exact({ name: Text, ...spanKeys(bounds), strand: oneOf([1, -1]) }),
		spanRule(bounds),
	);
}

/** Where a disagreement lies: over a span, or at a point. */
type Lies =
	| { start: number; end: number; at?: undefined }
	| { at: number; start?: undefined; end?: undefined };

/**
 * A place where reads differ from the record: a span, or a point `at` which they add bases. Its
 * `bases` are what the reads hold there, none for a deletion.
 */
function disagreement(bounds: Bounds) {
	const { start, end } = spanKeys(bounds);
	return v.pipe(
		exact({
			name: Text,
			start: v.optional(start),
			end: v.optional(end),
			at: v.optional(point(bounds)),
			bases: v.pipe(Text, Nucleotides),
			reads: list(Text),
			color: v.optional(Color),
		}),
		rule(function* ({ start, end, at, bases }) {
			if (at !== undefined) {
				if (start !== undefined || end !== undefined) {
					yield [["at"], "must not come with start or end"];
				} else if (!bases) {
					yield [["bases"], "must hold at least one base at a point"];
				}
			} else if (start === undefined) {
				yield end === undefined
					? [[], "must have start and end, or at"]
					: [["start"], "missing"];
			} else if (end === undefined) {
				yield [["end"], "missing"];
			} else {
				yield* spanProblems(bounds, start, end);
			}
		}),
		// The rule has passed, so the disagreement lies one way or the other.
		v.transform(
			<T extends object>(given: T) => given as Omit<T, keyof Lies> & Lies,
		),
	);
}

const Curve = list(
	v.pipe(v.number("must be a number"), v.finite("must be a finite number")),
);

/**
 * Curves `A`, `C`, `G` and `T` sampled alike, and `peaks`: pairs of a sample and the base it lies
 * over, the samples ascending. A bottom-strand read's bases may descend.
 */
function track(bounds: Bounds) {
	const peak = v.pipe(
		list(v.unknown()),
		v.length(2, "must be a pair, a sample and a base"),
		v.tuple([NonNegative, base(bounds)]),
	);
	return v.pipe(
		exact({
			name: Text,
			curves: exact({ A: Curve, C: Curve, G: Curve, T: Curve }),
			peaks: list(peak),
		}),
		rule(function* ({ curves, peaks }) {
			const samples = curves.A.length;
			for (const letter of ["C", "G", "T"] as const) {
				if (curves[letter].length !== samples) {
					yield [
						["curves", letter],
						`must be as long as curves.A, ${samples} samples`,
					];
				}
			}
			for (const [i, [sample]] of peaks.entries()) {
				if (sample >= samples) {
					yield [
						["peaks", i, 0],
						`must be less than the curves' length, ${samples}`,
					];
				}
				if (i > 0 && sample <= peaks[i - 1][0]) {
					yield [
						["peaks", i, 0],
						"must be greater than the previous peak's sample",
					];
				}
			}
		}),
	);
}

/** A record's reads are each named once, and a disagreement names only its reads. */
function recordSchema(bounds: Bounds) {
	return v.pipe(
		exact({
			name: Text,
			circular: v.boolean("must be true or false"),
			bases: Bases,
			features: v.optional(list(feature(bounds)), () => []),
			primers: v.optional(list(primer(bounds)), () => []),
			cuts: v.optional(list(cut(bounds)), () => []),
			insertions: v.optional(list(insertion(bounds)), () => []),
			reads: v.optional(list(read(bounds)), () => []),
			disagreements: v.optional(list(disagreement(bounds)), () => []),
			tracks: v.optional(list(track(bounds)), () => []),
		}),
		rule(function* ({ reads, disagreements }) {
			const first = new Map<string, number>();
			for (const [i, { name }] of reads.entries()) {
				const earlier = first.get(name);
				if (earlier === undefined) {
					first.set(name, i);
				} else {
					yield [
						["reads", i, "name"],
						`must differ from reads[${earlier}].name`,
					];
				}
			}
			for (const [i, { reads: names }] of disagreements.entries()) {
				for (const [j, name] of names.entries()) {
					if (!first.has(name)) {
						yield [
							["disagreements", i, "reads", j],
							"names no read in the record",
						];
					}
				}
			}
		}),
	);
}

/** One DNA molecule as a caller hands it over, with each missing list empty. */
export type Record = v.InferOutput<ReturnType<typeof recordSchema>>;

/** One of a record's features. */
export type Feature = Record["features"][number];

/** One of a record's insertions. */
export type Insertion = Record["insertions"][number];

/** One of a record's reads. */
export type Read = Record["reads"][number];

/** One of a record's disagreements: over a span where `at` is undefined, else at a point. */
export type Disagreement = Record["disagreements"][number];

/** One of a record's tracks. */
export type Track = Record["tracks"][number];

/** What `record`'s coordinates count against: its length, and whether it is circular. */
export function recordBounds({ bases, circular }: Record): Bounds {
	return { length: bases.length, circular };
}

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

/** What `input` is checked against as a record: the format, bound by its own bases. */
export function recordSchemaOf(input: unknown) {
	return recordSchema(boundsOf(input));
}

/** Return `input` as a typed record, or throw one FormatError naming every problem. */
export function check(input: unknown): Record {
	return parse(recordSchemaOf(input), input, { name: "record" });
}
