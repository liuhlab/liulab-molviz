/** The viewer. The build exposes each export here on the global `molviz`. */

import { draw, drawGel } from "./draw";
import { gelSvg, plateSvg, svg } from "./drawing";
import { checkGel } from "./gel";
import { checkPlate } from "./plate";
import { check } from "./record";

const exported = {
	check,
	checkGel,
	checkPlate,
	draw,
	drawGel,
	gelSvg,
	plateSvg,
	svg,
};

export { check, checkGel, checkPlate, draw, drawGel, gelSvg, plateSvg, svg };

/** A call's name on the global. */
type Call = keyof typeof exported;

/**
 * Each input's calls by their names on the global, by the input's name: the call that checks
 * it, the one that draws it into an element, and the one that draws it as SVG text. A plate
 * has only its check.
 */
export const calls = {
	record: { check: "check", draw: "draw", svg: "svg" },
	gel: { check: "checkGel", draw: "drawGel", svg: "gelSvg" },
	plate: { check: "checkPlate" },
} as const satisfies {
	readonly [name: string]: {
		readonly check: Call;
		readonly draw?: Call;
		readonly svg?: Call;
	};
};
