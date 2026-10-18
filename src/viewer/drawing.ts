/** An input drawn as SVG text, with no DOM. */

import { checkGel } from "./gel";
import { layoutGel } from "./gel-layout";
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

/** What each call that draws as SVG text returns. */
export interface Drawing {
	/** The whole drawing. Its width and height have no unit: one unit is one point. */
	readonly svg: string;
	/** One SVG per PDF page, the map first. */
	readonly pages: readonly string[];
	/** The labels left out because they would overlap, each counted in the notice. */
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

/** Check `gel` and lay it out. Throws one FormatError naming every problem in the gel. */
export function prepareGel(gel: unknown): Scene {
	return layoutGel(checkGel(gel));
}

/**
 * Draw `record` with `options` as SVG text, every letter an outline. Throws one FormatError
 * naming every problem in the record, or else in the options.
 */
export function svg(record: unknown, options: unknown = {}): Drawing {
	return whole(toSvg(prepare(record, options)));
}

/**
 * Draw `gel` as SVG text, every letter an outline. Ladder sizes that would crowd are left out
 * and not counted, so `hidden` stays empty. Throws one FormatError naming every problem in the
 * gel.
 */
export function gelSvg(gel: unknown): Drawing {
	return whole(toSvg(prepareGel(gel)));
}

/** `svg` as a drawing of one page that counts no hidden label. */
function whole(svg: string): Drawing {
	return { svg, pages: [svg], hidden: [], notice: "" };
}
