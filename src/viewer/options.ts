/**
 * A drawing's options: what a caller may change about how a record is drawn. Each says what is
 * on at the start; a page keeps the rest behind its switches, and a file leaves it out.
 */

import * as v from "valibot";
import { uniqueCutters } from "./cuts";
import {
	exact,
	folded,
	list,
	oneOf,
	PositiveInteger,
	parse,
	Text,
} from "./format";
import { KINDS } from "./labels";
import { type Record, span } from "./record";

const OnOff = v.boolean("must be true or false");

/** The most bases of a span the sequence view draws. */
export const LIMIT = 100_000;

function optionsSchema(record: Record) {
	const bounds = { length: record.bases.length, circular: record.circular };
	const names = answersTo(record);
	const options = exact({
		/** Draw only this stretch, as a line numbered as the record. The whole record by default. */
		span: v.optional(span(bounds), () => ({ start: 0, end: bounds.length })),
		/** The map a page opens on, or the one a file draws. */
		map: v.optional(oneOf(["line"]), "line"),
		/** The feature types off at the start. A type the record lacks is ignored. */
		types_off: v.optional(list(Text), () => ["source"]),
		/** The kinds off at the start. */
		kinds_off: v.optional(list(oneOf(KINDS)), () => []),
		/**
		 * The enzymes whose cut sites are on at the start, the unique cutters by default. A name
		 * matches whatever its case; one with no cut in the record is ignored.
		 */
		enzymes: v.optional(list(Text), () => uniqueCutters(record)),
		/** The names lit; everything else is dimmed. Each must be one `answersTo` gives. */
		highlight: v.optional(
			list(
				v.pipe(
					Text,
					v.check(
						(name) => names.has(folded(name)),
						"names nothing in the record",
					),
				),
			),
			() => [],
		),
		/** Whether the sequence view is drawn, for a span of at most `LIMIT` bases. */
		sequence_view: v.optional(OnOff, false),
		/** How many bases a row of the sequence view holds, the last row perhaps fewer. */
		bases_per_row: v.optional(PositiveInteger, 60),
		/** Whether the sequence view draws the bottom strand under the top. */
		bottom_strand: v.optional(OnOff, true),
	});
	return v.pipe(
		options,
		v.forward(
			v.check(
				({ span, sequence_view }) =>
					!sequence_view || span.end - span.start <= LIMIT,
				({ input: { span } }) =>
					`must be false past ${grouped(LIMIT)} bases, and the span holds ${grouped(span.end - span.start)}`,
			),
			["sequence_view"],
		),
	);
}

/** `n` with its thousands grouped by commas, as `100,000`. */
function grouped(n: number): string {
	return String(n).replace(/\B(?=(\d{3})+$)/g, ",");
}

/** A drawing's options, with each one left out at its default. */
export type Options = v.InferOutput<ReturnType<typeof optionsSchema>>;

/**
 * Return `input` as options for drawing `record`, or throw one FormatError naming every
 * problem by its path from `options`. An unknown option is a problem.
 */
export function checkOptions(input: unknown, record: Record): Options {
	return parse(optionsSchema(record), input, { prefix: "options" });
}

/**
 * The names a highlight may give for `record`, each `folded`: its features', primers' and
 * insertions', and each enzyme with a cut in it.
 */
export function answersTo(record: Record): Set<string> {
	return new Set(
		[
			...record.features,
			...record.primers,
			...record.insertions,
			...record.cuts.map(({ enzyme }) => ({ name: enzyme })),
		].map(({ name }) => folded(name)),
	);
}
