/** A record laid out as its views: the map, and the sequence view under it if the options draw one. */

import { type Input, rowPages, stacked, type Where } from "./drawing";
import { checkOptions, type Options } from "./format/options";
import { check, type Record } from "./format/record";
import { type CircleScene, layoutCircle } from "./map/circle";
import { type LineScene, layoutLine } from "./map/line";
import { WIDTH } from "./map/map";
import type { MapScene } from "./scene";
import { layoutSequence, type SequenceScene } from "./sequence/view";

/** A record laid out: its map, and its sequence view if the options draw one. */
export interface Views {
	readonly map: MapScene;
	readonly sequence: SequenceScene | null;
}

/**
 * Check `record`, then `options` against it, and lay the record out on the map they name.
 * Throws one FormatError naming every problem in the record, or else in the options.
 */
export function prepare(record: unknown, options: unknown): MapScene {
	return prepareViews(record, options).map;
}

/** `prepare`, with the sequence view laid out too if `options` draw it, for a `page` or a file. */
export function prepareViews(
	record: unknown,
	options: unknown,
	where: Partial<Where> = {},
): Views {
	const checked = check(record);
	return layoutViews(checked, checkOptions(options, checked, where));
}

/** Lay `record`'s map out as `options` say, and its sequence view if they draw one. */
export function layoutViews(record: Record, options: Options): Views {
	return {
		map: layoutMap(record, options),
		sequence: options.sequence_view ? layoutSequence(record, options) : null,
	};
}

/**
 * Lay `record` out on the map `options` name, `zoom` times its opening size, the circle's origin
 * turned `turn` degrees clockwise from the top.
 */
export function layoutMap(
	record: Record,
	options: Options,
	{
		zoom = 1,
		turn = 0,
	}: { readonly zoom?: number; readonly turn?: number } = {},
): LineScene | CircleScene {
	return options.map === "circle"
		? layoutCircle(record, options, turn, zoom)
		: layoutLine(record, options, WIDTH * zoom);
}

/** `views` as one scene, the sequence view under the map, hiding what the map hides. */
export function stackedViews({ map, sequence }: Views): MapScene {
	return sequence === null
		? map
		: { ...stacked(map, sequence), hidden: map.hidden };
}

/**
 * The record as an input: its views stacked, the sequence view under the map. A PDF has the map
 * on its first page and the view's rows on the pages after.
 */
export const recordInput: Input<Record> = {
	check,
	checkOptions(record, options, where) {
		checkOptions(options, record, where);
	},
	layout(record, options, where) {
		const views = layoutViews(record, checkOptions(options, record, where));
		return {
			scene: stackedViews(views),
			pages:
				views.sequence === null
					? null
					: [views.map, ...rowPages(views.sequence)],
			hidden: views.map.hidden,
		};
	},
};
