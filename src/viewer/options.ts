/**
 * A drawing's options: what a caller may change about how a record is drawn. Each says what is
 * on at the start; a page keeps the rest behind its switches, and a file leaves it out.
 */

import * as v from "valibot";
import { uniqueCutters } from "./cuts";
import { exact, folded, list, oneOf, parse, Text } from "./format";
import { KINDS } from "./labels";
import { type Record, span } from "./record";

function optionsSchema(record: Record, drawn: readonly Record[]) {
	const bounds = { length: record.bases.length, circular: record.circular };
	const names = new Set(drawn.flatMap((one) => [...answersTo(one)]));
	const nothing = drawn.length > 1 ? "any record" : "the record";
	return exact({
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
						`names nothing in ${nothing}`,
					),
				),
			),
			() => [],
		),
	});
}

/** A drawing's options, with each one left out at its default. */
export type Options = v.InferOutput<ReturnType<typeof optionsSchema>>;

/**
 * Return `input` as options for drawing `record`, one of the records `drawn` together, or throw
 * one FormatError naming every problem by its path from `options`. An unknown option is a
 * problem.
 */
export function checkOptions(
	input: unknown,
	record: Record,
	drawn: readonly Record[] = [record],
): Options {
	return parse(optionsSchema(record, drawn), input, { prefix: "options" });
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
