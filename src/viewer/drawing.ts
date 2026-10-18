/** A record drawn as SVG text, with no DOM. */

import { checkOptions } from "./options";
import { check, type Span } from "./record";

/** A kind, by its list's key in the record. */
export type Kind = "features" | "primers" | "cuts" | "insertions";

/** A label left out because it would overlap. */
export interface Hidden {
	readonly kind: Kind;
	readonly name: string;
	/** The spans the label belongs to. */
	readonly spans: readonly Span[];
}

/** What `svg` returns. */
export interface Drawing {
	/** The whole drawing. Its width and height have no unit: one unit is one point. */
	readonly svg: string;
	/** One SVG per PDF page, the map first. */
	readonly pages: readonly string[];
	/** The labels left out of the map. */
	readonly hidden: readonly Hidden[];
	/** The hidden-label notice as a sentence, empty when nothing hides. */
	readonly notice: string;
}

/** A blank drawing, until the line is drawn. */
const BLANK =
	'<svg xmlns="http://www.w3.org/2000/svg" width="720" height="40" viewBox="0 0 720 40"/>';

/**
 * Draw `record` with `options` as SVG text, every letter an outline. Throws one FormatError
 * naming every problem in the record, or else in the options.
 */
export function svg(record: unknown, options: unknown = {}): Drawing {
	checkOptions(options, check(record));
	return { svg: BLANK, pages: [BLANK], hidden: [], notice: "" };
}
