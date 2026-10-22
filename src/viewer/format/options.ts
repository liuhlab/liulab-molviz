/**
 * A drawing's options: what a caller may change about how a record is drawn. Each says what is
 * on at the start; a page keeps the rest behind its switches, and a file leaves it out.
 */

import * as v from "valibot";
import { uniqueCutters } from "../cuts";
import {
	exact,
	folded,
	list,
	oneOf,
	orThrow,
	type Parsed,
	PositiveInteger,
	parsed,
	rule,
	Text,
} from "./format";
import { type Record, recordBounds, type Span, span } from "./record";

/** Each kind a record holds, by its list's key in the record. */
export const KINDS = [
	"features",
	"primers",
	"cuts",
	"insertions",
	"reads",
	"disagreements",
	"tracks",
] as const;

export type Kind = (typeof KINDS)[number];

const OnOff = v.boolean("must be true or false");

/** The most bases of a span the sequence view draws. */
export const LIMIT = 100_000;

/** Where a record is drawn: on a `page` or else in a file, among the records drawn `together`. */
interface Where {
	readonly page: boolean;
	readonly together: readonly Record[];
}

function optionsSchema(record: Record, { page, together }: Where) {
	const bounds = recordBounds(record);
	const names = new Set(together.flatMap((one) => [...answersTo(one)]));
	const searched = together.length > 1 ? "any record" : "the record";
	const whole = ({ start, end }: Span) => start === 0 && end === bounds.length;
	const given = exact({
		/** Draw only this stretch, as a line numbered as the record. The whole record by default. */
		span: v.optional(span(bounds), () => ({ start: 0, end: bounds.length })),
		/**
		 * The map a page opens on, or the one a file draws: the circle for a circular record
		 * drawn whole, else the line.
		 */
		map: v.optional(
			v.pipe(
				oneOf(["circle", "line"]),
				v.check(
					(map) => map === "line" || record.circular,
					'must be "line" on a linear record',
				),
			),
		),
		/** The feature types off at the start. A type the record lacks is ignored. */
		types_off: v.optional(list(Text), () => ["source"]),
		/** The kinds off at the start. */
		kinds_off: v.optional(list(oneOf(KINDS)), () => []),
		/**
		 * The enzymes whose cut sites are on at the start, the unique cutters by default. A name
		 * matches whatever its case; one with no cut in the record is ignored.
		 */
		enzymes: v.optional(list(Text), () => uniqueCutters(record)),
		/**
		 * The names lit; everything else is dimmed. Each must be one `answersTo` gives for a
		 * record drawn.
		 */
		highlight: v.optional(
			list(
				v.pipe(
					Text,
					v.check(
						(name) => names.has(folded(name)),
						`names nothing in ${searched}`,
					),
				),
			),
			() => [],
		),
		/**
		 * Whether the sequence view is drawn, for a span of at most `LIMIT` bases. Past that a
		 * page leaves it out, and for a file it is an error.
		 */
		sequence_view: v.optional(OnOff, false),
		/** How many bases a row of the sequence view holds, the last row perhaps fewer. */
		bases_per_row: v.optional(PositiveInteger, 60),
		/** Whether the sequence view draws the bottom strand under the top. */
		bottom_strand: v.optional(OnOff, true),
	});
	const fits = ({ start, end }: Span) => end - start <= LIMIT;
	return v.pipe(
		given,
		v.transform((options) =>
			page && !fits(options.span)
				? { ...options, sequence_view: false }
				: options,
		),
		rule<v.InferOutput<typeof given>>(function* ({ span, map }) {
			if (map === "circle" && !whole(span)) {
				yield [["map"], 'must be "line" when span is not the whole record'];
			}
		}),
		v.forward(
			v.check(
				({ span, sequence_view }) => !sequence_view || fits(span),
				({ input: { span } }) =>
					`must be false past ${grouped(LIMIT)} bases, and the span holds ${grouped(span.end - span.start)}`,
			),
			["sequence_view"],
		),
		v.transform((options) => ({
			...options,
			map:
				options.map ??
				(record.circular && whole(options.span) ? "circle" : "line"),
		})),
	);
}

/** `n` with its thousands grouped by commas, as `100,000`. */
function grouped(n: number): string {
	return String(n).replace(/\B(?=(\d{3})+$)/g, ",");
}

/** A drawing's options, with each one left out at its default. */
export type Options = v.InferOutput<ReturnType<typeof optionsSchema>>;

/**
 * Return `input` as options for drawing `record`, one of the records drawn `together`, on a
 * `page` or else in a file, or throw one FormatError naming every problem by its path from
 * `options`. An unknown option is a problem.
 */
export function checkOptions(
	input: unknown,
	record: Record,
	where: Partial<Where> = {},
): Options {
	return orThrow(parsedOptions(input, record, where));
}

/** `checkOptions`, returning each problem rather than throwing. */
export function parsedOptions(
	input: unknown,
	record: Record,
	{ page = false, together = [record] }: Partial<Where> = {},
): Parsed<Options> {
	return parsed(optionsSchema(record, { page, together }), input, {
		prefix: "options",
	});
}

/** Whether `input`, as options are given, leaves `bases_per_row` out, for a page to fit. */
export function rowsLeftOut(input: unknown): boolean {
	return (
		(input as { bases_per_row?: unknown } | null)?.bases_per_row === undefined
	);
}

/**
 * The names a highlight may give for `record`, each `folded`: its features', primers',
 * insertions', reads', disagreements' and tracks', and each enzyme with a cut in it.
 */
export function answersTo(record: Record): Set<string> {
	return new Set(
		[
			...record.features,
			...record.primers,
			...record.insertions,
			...record.reads,
			...record.disagreements,
			...record.tracks,
			...record.cuts.map(({ enzyme }) => ({ name: enzyme })),
		].map(({ name }) => folded(name)),
	);
}
