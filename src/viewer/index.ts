/** The viewer. The build exposes each export here on the global `molviz`. */

import { draw, drawGel, drawPlate } from "./draw";
import { gelSvg, plateSvg, svg } from "./drawing";
import { checkGel } from "./gel";
import { checkPlate } from "./plate";
import { check } from "./record";
import { fontRules, gelStillSvg, plateStillSvg, stillSvg } from "./still";

const exported = {
	check,
	checkGel,
	checkPlate,
	draw,
	drawGel,
	drawPlate,
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
	checkGel,
	checkPlate,
	draw,
	drawGel,
	drawPlate,
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
} as const satisfies {
	readonly [name: string]: {
		readonly check: Call;
		readonly draw: Call;
		readonly svg: Call;
		readonly still: Call;
	};
};
