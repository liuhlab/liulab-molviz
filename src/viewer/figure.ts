/** A figure: records stacked top to bottom, each drawn to one set of options. */

import * as v from "valibot";
import { FormatError, list, parse } from "./format";
import type { MapScene } from "./labels";
import { layout } from "./line";
import { checkOptions, type Options } from "./options";
import { type Record, recordSchemaOf } from "./record";
import { moved, type Shape } from "./scene";
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

/**
 * Check `records`, then `options` against each, and lay the records out stacked as they say.
 */
export function prepareFigure(records: unknown, options: unknown): MapScene {
	const checked = checkFigure(records);
	const each = checkEach(options, checked);
	const scenes = checked.map((record, i) => layout(record, each[i]));
	return stacked(
		checked.map(({ name }) => name),
		scenes,
	);
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
 * `scenes` one under another, each keeping its x and set under its name from `names`. One
 * scene is left as it is, with no name. Each scene's own title holds its name, so its extent
 * already covers the name.
 */
function stacked(
	names: readonly string[],
	scenes: readonly MapScene[],
): MapScene {
	if (scenes.length === 1) return scenes[0];
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
		hidden: scenes.flatMap(({ hidden }) => hidden),
	};
}
