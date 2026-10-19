/**
 * A figure: records stacked top to bottom, each drawn to one set of options as `svg` draws it.
 * Lines keep their x, and a circle is centred on them. When two or more stack, each record's
 * name is set above it. A file's PDF has the maps on page 1, then each record's sequence-view
 * rows, the first of its pages under its name.
 */

import * as v from "valibot";
import {
	type Drawing,
	layoutViews,
	stackedViews,
	toDrawing,
	type Views,
} from "./drawing";
import { list, orThrow, type Problem, parse } from "./format";
import type { MapScene } from "./labels";
import { MARGIN, NAME_SIZE } from "./line";
import { type Options, parsedOptions } from "./options";
import { rowPages } from "./pages";
import { MUTED } from "./paint";
import { type Record, recordSchemaOf } from "./record";
import { moved, type Scene, type Shape } from "./scene";
import { baseline, type Face, height } from "./text";

/** The face of a stacked record's name, set at `NAME_SIZE` in `MUTED`. */
const NAME_FACE: Face = "sans-bold";

/** The room under a name, before its record. */
const UNDER_NAME = 2;
/** The room from one record to the next record's name. */
const BETWEEN = 12;

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

/** One of a figure's records laid out. */
interface FigureRecord {
	/** Its name, set above it when two or more records stack. */
	readonly name: string;
	/** Its views, drawn to the figure's options. */
	readonly views: Views;
	/** Whether its map is the circle. */
	readonly circle: boolean;
}

/** A scene of one of a figure's records, to stack with the others. */
type Part = Pick<FigureRecord, "name" | "circle"> & {
	readonly scene: Scene | MapScene;
};

/** Check `records`, then `options` against each, for a `page` or a file, and lay each out. */
function prepareRecords(
	records: unknown,
	options: unknown,
	where: { page?: boolean } = {},
): FigureRecord[] {
	const checked = checkFigure(records);
	const each = checkEach(options, checked, where);
	return checked.map((record, i) => ({
		name: record.name,
		views: layoutViews(record, each[i]),
		circle: each[i].map === "circle",
	}));
}

/** `records` stacked, each as `svg` draws it. */
function figureScene(records: readonly FigureRecord[]): MapScene {
	return stackRecords(
		records.map((one) => ({ ...one, scene: stackedViews(one.views) })),
		records.length > 1,
	);
}

/**
 * Check `records`, then `options` against each, and lay the records out stacked, each as `svg`
 * draws it, or on a `page` as `draw` does.
 */
export function prepareFigure(
	records: unknown,
	options: unknown,
	where: { page?: boolean } = {},
): MapScene {
	return figureScene(prepareRecords(records, options, where));
}

/** A figure laid out as a file draws it. */
export interface FigureFile {
	/** The whole drawing. */
	readonly scene: MapScene;
	/** One scene per PDF page, or null when the whole drawing is the one page. */
	readonly pages: readonly Scene[] | null;
}

/** `prepareFigure` for a file, with a PDF's pages when the records draw their sequence views. */
export function prepareFigureFile(
	records: unknown,
	options: unknown,
): FigureFile {
	const prepared = prepareRecords(records, options);
	const scene = figureScene(prepared);
	if (prepared.every(({ views }) => views.sequence === null)) {
		return { scene, pages: null };
	}
	const named = prepared.length > 1;
	const maps = stackRecords(
		prepared.map((one) => ({ ...one, scene: one.views.map })),
		named,
	);
	const rows = prepared.flatMap(({ name, views }) => {
		if (views.sequence === null) return [];
		const [first, ...rest] = rowPages(views.sequence);
		return [
			stackRecords([{ name, circle: false, scene: first }], named),
			...rest,
		];
	});
	return { scene, pages: [maps, ...rows] };
}

/**
 * Draw `records` stacked, each with `options`, as SVG text, every letter an outline. Throws one
 * FormatError naming every problem in the records, or else in the options.
 */
export function figureSvg(records: unknown, options: unknown = {}): Drawing {
	const { scene, pages } = prepareFigureFile(records, options);
	return toDrawing(scene, pages);
}

/**
 * `input` as options for each of `records`, on a `page` or else in a file, or one FormatError
 * naming each problem once. A problem only some records have names them after its path, as
 * `options.span.end (records[1])`.
 */
function checkEach(
	input: unknown,
	records: readonly Record[],
	{ page = false }: { page?: boolean },
): Options[] {
	const checked: Options[] = [];
	const problems = new Map<string, { problem: Problem; which: number[] }>();
	for (const [i, record] of records.entries()) {
		const result = parsedOptions(input, record, { page, together: records });
		if ("output" in result) {
			checked.push(result.output);
			continue;
		}
		for (const problem of result.problems) {
			const key = JSON.stringify([problem.path, problem.message]);
			const seen = problems.get(key) ?? { problem, which: [] };
			seen.which.push(i);
			problems.set(key, seen);
		}
	}
	const reported = [...problems.values()].map(({ problem, which }) =>
		which.length === records.length
			? problem
			: {
					...problem,
					path: `${problem.path} (${which.map((i) => `records[${i}]`).join(", ")})`,
				},
	);
	return orThrow(
		reported.length ? { problems: reported } : { output: checked },
	);
}

/**
 * `parts` one under another, each under its name when `named`. Unnamed, the one part is left as
 * it is.
 */
function stackRecords(parts: readonly Part[], named: boolean): MapScene {
	const hidden = parts.flatMap(({ scene }) =>
		"hidden" in scene ? scene.hidden : [],
	);
	if (!named) return { ...parts[0].scene, hidden };
	const lines = parts
		.filter(({ circle }) => !circle)
		.map(({ scene }) => scene.extent);
	const middle = lines.length
		? (Math.min(...lines.map(({ x }) => x)) +
				Math.max(...lines.map(({ x, width }) => x + width))) /
			2
		: 0;
	const dxs = parts.map(({ circle }) => (circle ? middle : 0));
	const left = Math.min(
		...parts.map(({ scene }, i) => scene.extent.x + dxs[i]),
	);
	const right = Math.max(
		...parts.map(
			({ scene }, i) => scene.extent.x + scene.extent.width + dxs[i],
		),
	);
	const nameHeight = height(NAME_FACE, NAME_SIZE);
	const nameRoom = nameHeight + UNDER_NAME;
	const shapes: Shape[] = [];
	let recordTop = parts[0].scene.extent.y;
	const top = recordTop - nameRoom - MARGIN;
	let bottom = top;
	for (const [i, { name, scene }] of parts.entries()) {
		const nameTop = recordTop - nameRoom;
		shapes.push({
			shape: "text",
			text: name,
			face: NAME_FACE,
			size: NAME_SIZE,
			x: left + MARGIN,
			y: baseline(NAME_FACE, NAME_SIZE, nameTop + nameHeight / 2),
			anchor: "start",
			fill: MUTED,
		});
		const dy = recordTop - scene.extent.y;
		shapes.push(...scene.shapes.map((shape) => moved(shape, dxs[i], dy)));
		bottom = recordTop + scene.extent.height;
		recordTop = bottom + BETWEEN + nameRoom;
	}
	return {
		extent: { x: left, y: top, width: right - left, height: bottom - top },
		shapes,
		hidden,
	};
}
