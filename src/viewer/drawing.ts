/** A record drawn as SVG text, with no DOM. */

import { layout } from "./line";
import { checkOptions } from "./options";
import { check, type Span } from "./record";
import type { Scene } from "./scene";
import { toSvg } from "./svg";

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

/**
 * Check `record`, then `options` against it, and lay the record out as they say. Throws one
 * FormatError naming every problem in the record, or else in the options.
 */
export function prepare(record: unknown, options: unknown): Scene {
	const checked = check(record);
	return layout(checked, checkOptions(options, checked));
}

/**
 * Draw `record` with `options` as SVG text, every letter an outline. Throws one FormatError
 * naming every problem in the record, or else in the options.
 */
export function svg(record: unknown, options: unknown = {}): Drawing {
	const drawn = toSvg(prepare(record, options));
	return { svg: drawn, pages: [drawn], hidden: [], notice: "" };
}
