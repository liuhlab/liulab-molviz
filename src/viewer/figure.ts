/** A figure: records stacked top to bottom, each drawn to one set of options. */

import * as v from "valibot";
import {
	type Drawing,
	drawn,
	layoutViews,
	stackedViews,
	type Views,
} from "./drawing";
import { FormatError, list, parse } from "./format";
import type { MapScene } from "./labels";
import { checkOptions, type Options } from "./options";
import { rowPages } from "./pages";
import { type Record, recordSchemaOf } from "./record";
import { moved, type Scene, type Shape } from "./scene";
import { toSvg } from "./svg";
import { baseline, type Face, height } from "./text";

/** How a stacked record's name is set above it, as mbio sets it. */
const NAME_FACE: Face = "sans-bold";
const NAME_SIZE = 13.5;
const NAME_FILL = "#5c626b";

/** The room under a name, before its record. */
const UNDER_NAME = 2;
/** The room from one record to the next record's name. */
const BETWEEN = 12;
/** The room above the first name, and left of every name: a line's own margin. */
const MARGIN = 16;

/**
 * Return `input` as a figure's records, one or more, or throw one FormatError naming every
 * problem by its path from `records`.
 */
export function checkFigure(input: unknown): Record[] {
	const items: unknown[] = Array.isArray(input) ? input : [];
	const schema = v.pipe(
		list(v.unknown()),
		v.minLength(1, "must hold at least one record"),
		v.tuple(items.map(recordSchemaOf)),
	);
	return parse(schema, input, { prefix: "records" });
}

/** One of a figure's records laid out: its name, and its views drawn to the figure's options. */
interface Laid {
	readonly name: string;
	readonly views: Views;
}

/** Check `records`, then `options` against each, and lay each record's views out. */
function layOut(records: unknown, options: unknown): Laid[] {
	const checked = checkFigure(records);
	const each = checkEach(options, checked);
	return checked.map((record, i) => ({
		name: record.name,
		views: layoutViews(record, each[i]),
	}));
}

/** The names set above `laid`'s records: none for one record. */
function namesOf(laid: readonly Laid[]): string[] | null {
	return laid.length > 1 ? laid.map(({ name }) => name) : null;
}

/** `laid` stacked, each record as `svg` draws it. */
function whole(laid: readonly Laid[]): MapScene {
	return stacked(
		laid.map(({ views }) => stackedViews(views)),
		namesOf(laid),
	);
}

/**
 * Check `records`, then `options` against each, and lay the records out stacked, each as `svg`
 * draws it.
 */
export function prepareFigure(records: unknown, options: unknown): MapScene {
	return whole(layOut(records, options));
}

/** A figure laid out as a file draws it. */
export interface FigureFile {
	/** The whole drawing. */
	readonly scene: MapScene;
	/** One scene per PDF page, or null when the whole drawing is the one page. */
	readonly pages: readonly Scene[] | null;
}

/**
 * `prepareFigure`, with a PDF's pages when the records draw their sequence views: the maps
 * stacked, then each record's rows in record order, the first of them under the record's name
 * when two or more stack.
 */
export function prepareFigureFile(
	records: unknown,
	options: unknown,
): FigureFile {
	const laid = layOut(records, options);
	const scene = whole(laid);
	if (laid.every(({ views }) => views.sequence === null)) {
		return { scene, pages: null };
	}
	const names = namesOf(laid);
	const maps = stacked(
		laid.map(({ views }) => views.map),
		names,
	);
	const rows = laid.flatMap(({ name, views }) => {
		if (views.sequence === null) return [];
		const [first, ...rest] = rowPages(views.sequence);
		return [stacked([first], names && [name]), ...rest];
	});
	return { scene, pages: [maps, ...rows] };
}

/**
 * Draw `records` stacked, each with `options`, as SVG text, every letter an outline. A PDF has
 * the maps on its first page and each record's sequence-view rows on the pages after. Throws one
 * FormatError naming every problem in the records, or else in the options.
 */
export function figureSvg(records: unknown, options: unknown = {}): Drawing {
	const { scene, pages } = prepareFigureFile(records, options);
	const drawing = drawn(scene, toSvg);
	return {
		...drawing,
		pages: pages === null ? [drawing.svg] : pages.map(toSvg),
	};
}

/**
 * `input` as options for each of `records`, or one FormatError naming each problem once. A
 * problem only some records have names them after its path, as `options.span.end (records[1])`.
 */
function checkEach(input: unknown, records: readonly Record[]): Options[] {
	const checked: Options[] = [];
	const problems = new Map<string, number[]>();
	for (const [i, record] of records.entries()) {
		try {
			checked.push(checkOptions(input, record, { drawn: records }));
		} catch (error) {
			if (!(error instanceof FormatError)) throw error;
			for (const line of error.message.split("\n")) {
				problems.set(line, [...(problems.get(line) ?? []), i]);
			}
		}
	}
	if (!problems.size) return checked;
	const lines = [...problems].map(([line, which]) => {
		if (which.length === records.length) return line;
		const at = line.indexOf(": ");
		const named = which.map((i) => `records[${i}]`).join(", ");
		return `${line.slice(0, at)} (${named})${line.slice(at)}`;
	});
	throw new FormatError(lines.join("\n"));
}

/**
 * `scenes` one under another, each keeping its x and set under its name from `names`. With no
 * names there is one scene, left as it is.
 */
function stacked(
	scenes: readonly (Scene | MapScene)[],
	names: readonly string[] | null,
): MapScene {
	const hidden = scenes.flatMap((scene) =>
		"hidden" in scene ? scene.hidden : [],
	);
	if (names === null) return { ...scenes[0], hidden };
	const left = Math.min(...scenes.map(({ extent }) => extent.x));
	const right = Math.max(
		...scenes.map(({ extent }) => extent.x + extent.width),
	);
	const nameHeight = height(NAME_FACE, NAME_SIZE);
	const named = nameHeight + UNDER_NAME;
	const shapes: Shape[] = [];
	let recordTop = scenes[0].extent.y;
	const top = recordTop - named - MARGIN;
	let bottom = top;
	for (const [i, { extent, shapes: own }] of scenes.entries()) {
		const nameTop = recordTop - named;
		shapes.push({
			shape: "text",
			text: names[i],
			face: NAME_FACE,
			size: NAME_SIZE,
			x: left + MARGIN,
			y: baseline(NAME_FACE, NAME_SIZE, nameTop + nameHeight / 2),
			anchor: "start",
			fill: NAME_FILL,
		});
		const dy = recordTop - extent.y;
		shapes.push(...own.map((shape) => moved(shape, 0, dy)));
		bottom = recordTop + extent.height;
		recordTop = bottom + BETWEEN + named;
	}
	return {
		extent: { x: left, y: top, width: right - left, height: bottom - top },
		shapes,
		hidden,
	};
}
