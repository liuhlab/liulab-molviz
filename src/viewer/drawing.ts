/** An input drawn as SVG text, with no DOM. */

import { prepareFigure } from "./figure";
import { checkGel } from "./gel";
import { layoutGel } from "./gel-layout";
import { type Hidden, type MapScene, notice } from "./labels";
import { layout } from "./line";
import { checkOptions } from "./options";
import { rowPages, stacked } from "./pages";
import { checkPlate } from "./plate";
import { layoutPlate } from "./plate-layout";
import { check } from "./record";
import type { Scene } from "./scene";
import { layoutSequence, type SequenceScene } from "./sequence";
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

/** A record laid out: its map, and its sequence view if the options draw one. */
export interface Views {
	readonly map: MapScene;
	readonly sequence: SequenceScene | null;
}

/**
 * Check `record`, then `options` against it, and lay the record's map out as they say. Throws
 * one FormatError naming every problem in the record, or else in the options.
 */
export function prepare(record: unknown, options: unknown): MapScene {
	return prepareViews(record, options).map;
}

/** `prepare`, with the sequence view laid out too if `options` draw it, for a `page` or a file. */
export function prepareViews(
	record: unknown,
	options: unknown,
	where: { page?: boolean } = {},
): Views {
	const checked = check(record);
	const drawn = checkOptions(options, checked, where);
	return {
		map: layout(checked, drawn),
		sequence: drawn.sequence_view ? layoutSequence(checked, drawn) : null,
	};
}

/** Check `gel` and lay it out. Throws one FormatError naming every problem in the gel. */
export function prepareGel(gel: unknown): Scene {
	return layoutGel(checkGel(gel));
}

/** Check `plate` and lay it out. Throws one FormatError naming every problem in the plate. */
export function preparePlate(plate: unknown): Scene {
	return layoutPlate(checkPlate(plate));
}

/** `views` as one scene, the sequence view under the map, hiding what the map hides. */
export function stackedViews({ map, sequence }: Views): MapScene {
	return sequence === null
		? map
		: { ...stacked(map, sequence), hidden: map.hidden };
}

/** `scene` written by `write`, with the labels it left out and their notice. */
export function drawn(
	scene: Scene | MapScene,
	write: (scene: Scene) => string,
): Omit<Drawing, "pages"> {
	const hidden = "hidden" in scene ? scene.hidden : [];
	return { svg: write(scene), hidden, notice: notice(hidden) };
}

/**
 * Draw `record` with `options` as SVG text, every letter an outline, the sequence view under
 * the map. A PDF has the map on its first page and the view's rows on the pages after. Throws
 * one FormatError naming every problem in the record, or else in the options.
 */
export function svg(record: unknown, options: unknown = {}): Drawing {
	const views = prepareViews(record, options);
	const drawing = whole(stackedViews(views));
	if (views.sequence === null) return drawing;
	return {
		...drawing,
		pages: [views.map, ...rowPages(views.sequence)].map(toSvg),
	};
}

/**
 * Draw `records` stacked, each with `options`, as SVG text, every letter an outline. Throws one
 * FormatError naming every problem in the records, or else in the options.
 */
export function figureSvg(records: unknown, options: unknown = {}): Drawing {
	return whole(prepareFigure(records, options));
}

/**
 * Draw `gel` as SVG text, every letter an outline. Ladder sizes that would crowd are left out
 * and not counted, so `hidden` stays empty. Throws one FormatError naming every problem in the
 * gel.
 */
export function gelSvg(gel: unknown): Drawing {
	return whole(prepareGel(gel));
}

/**
 * Draw `plate` as SVG text, every letter an outline. Throws one FormatError naming every
 * problem in the plate.
 */
export function plateSvg(plate: unknown): Drawing {
	return whole(preparePlate(plate));
}

/** `scene` as SVG text, a drawing of one page. */
function whole(scene: Scene | MapScene): Drawing {
	const drawing = drawn(scene, toSvg);
	return { ...drawing, pages: [drawing.svg] };
}
