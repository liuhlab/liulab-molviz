/** An input drawn as SVG text, with no DOM. */

import { checkGel } from "./gel";
import { layoutGel } from "./gel-layout";
import { type Hidden, type MapScene, notice } from "./labels";
import { layout } from "./line";
import { checkOptions } from "./options";
import { checkPlate } from "./plate";
import { layoutPlate } from "./plate-layout";
import { check } from "./record";
import type { Scene } from "./scene";
import { toSvg } from "./svg";

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
export function prepare(record: unknown, options: unknown): MapScene {
	const checked = check(record);
	return layout(checked, checkOptions(options, checked));
}

/** Check `gel` and lay it out. Throws one FormatError naming every problem in the gel. */
export function prepareGel(gel: unknown): Scene {
	return layoutGel(checkGel(gel));
}

/** Check `plate` and lay it out. Throws one FormatError naming every problem in the plate. */
export function preparePlate(plate: unknown): Scene {
	return layoutPlate(checkPlate(plate));
}

/**
 * Draw `record` with `options` as SVG text, every letter an outline. Throws one FormatError
 * naming every problem in the record, or else in the options.
 */
export function svg(record: unknown, options: unknown = {}): Drawing {
	const scene = prepare(record, options);
	const svg = toSvg(scene);
	const { hidden } = scene;
	return { svg, pages: [svg], hidden, notice: notice(hidden) };
}

/**
 * Draw `gel` as SVG text, every letter an outline. Ladder sizes that would crowd are left out
 * and not counted, so `hidden` stays empty. Throws one FormatError naming every problem in the
 * gel.
 */
export function gelSvg(gel: unknown): Drawing {
	return whole(toSvg(prepareGel(gel)));
}

/**
 * Draw `plate` as SVG text, every letter an outline. Throws one FormatError naming every
 * problem in the plate.
 */
export function plateSvg(plate: unknown): Drawing {
	return whole(toSvg(preparePlate(plate)));
}

/** `svg` as a drawing of one page that counts no hidden label. */
function whole(svg: string): Drawing {
	return { svg, pages: [svg], hidden: [], notice: "" };
}
