/**
 * A drawing's options: what a caller may change about how a record is drawn. Each says what is
 * on at the start; a page keeps the rest behind its switches, and a file leaves it out.
 */

import * as v from "valibot";
import { exact, list, parse, Text } from "./format";
import { type Record, span } from "./record";

function optionsSchema(record: Record) {
	const bounds = { length: record.bases.length, circular: record.circular };
	return exact({
		/** Draw only this stretch, as a line numbered as the record. The whole record by default. */
		span: v.optional(span(bounds), () => ({ start: 0, end: bounds.length })),
		/** The map a page opens on, or the one a file draws. */
		map: v.optional(v.picklist(["line"], 'must be "line"'), "line"),
		/** The feature types off at the start. A type the record lacks is ignored. */
		types_off: v.optional(list(Text), () => ["source"]),
	});
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
