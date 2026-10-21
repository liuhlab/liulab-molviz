/** The viewer. The build exposes each export here on the global `molviz`. */

import { declareFaces, draw, drawFigure, drawGel, drawPlate } from "./draw";
import { gelSvg, plateSvg, svg } from "./drawing";
import { checkFigure, figureSvg } from "./figure";
import { checkGel } from "./gel";
import { LIMIT } from "./options";
import { checkPlate } from "./plate";
import { check } from "./record";
import {
	figureStillSvg,
	fontRules,
	gelStillSvg,
	plateStillSvg,
	stillSvg,
} from "./still";

/** The most bases of a span the sequence view draws. */
export const SEQUENCE_VIEW_LIMIT = LIMIT;

const exported = {
	check,
	checkFigure,
	checkGel,
	checkPlate,
	declareFaces,
	draw,
	drawFigure,
	drawGel,
	drawPlate,
	figureStillSvg,
	figureSvg,
	fontRules,
	gelStillSvg,
	gelSvg,
	plateStillSvg,
	plateSvg,
	stillSvg,
	svg,
};

export {
	check,
	checkFigure,
	checkGel,
	checkPlate,
	declareFaces,
	draw,
	drawFigure,
	drawGel,
	drawPlate,
	figureStillSvg,
	figureSvg,
	fontRules,
	gelStillSvg,
	gelSvg,
	plateStillSvg,
	plateSvg,
	stillSvg,
	svg,
};

/** A call's name on the global. */
type Call = keyof typeof exported;

/**
 * Each input's calls by their names on the global, by the input's name: the call that checks
 * it, the one that draws it into an element, the one that draws it as SVG text, and the one
 * that draws it as a still SVG.
 */
export const calls = {
	record: { check: "check", draw: "draw", svg: "svg", still: "stillSvg" },
	gel: {
		check: "checkGel",
		draw: "drawGel",
		svg: "gelSvg",
		still: "gelStillSvg",
	},
	plate: {
		check: "checkPlate",
		draw: "drawPlate",
		svg: "plateSvg",
		still: "plateStillSvg",
	},
	figure: {
		check: "checkFigure",
		draw: "drawFigure",
		svg: "figureSvg",
		still: "figureStillSvg",
	},
} as const satisfies {
	readonly [name: string]: {
		readonly check: Call;
		readonly draw: Call;
		readonly svg: Call;
		readonly still: Call;
	};
};
