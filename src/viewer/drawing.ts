/** A record, a gel or a plate drawn as SVG text, with no DOM. */

import { checkGel } from "./gel";
import { layoutGel } from "./gel-layout";
import { layout } from "./line";
import { checkOptions } from "./options";
import { checkPlate } from "./plate";
import { layoutPlate } from "./plate-layout";
import { check, type Span } from "./record";
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

/** What `svg`, `gelSvg` and `plateSvg` return. */
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
 * Draw `record` with `options` as SVG text, every letter an outline. Throws one FormatError
 * naming every problem in the record, or else in the options.
 */
export function svg(record: unknown, options: unknown = {}): Drawing {
	const checked = check(record);
	return whole(toSvg(layout(checked, checkOptions(options, checked))));
}

/**
 * Draw `gel` as SVG text, every letter an outline. Throws one FormatError naming every problem
 * in the gel.
 */
export function gelSvg(gel: unknown): Drawing {
	return whole(toSvg(layoutGel(checkGel(gel))));
}

/**
 * Draw `plate` as SVG text, every letter an outline. Throws one FormatError naming every
 * problem in the plate.
 */
export function plateSvg(plate: unknown): Drawing {
	return whole(toSvg(layoutPlate(checkPlate(plate))));
}

/** `svg` as a drawing of one page that leaves no label out. */
function whole(svg: string): Drawing {
	return { svg, pages: [svg], hidden: [], notice: "" };
}
