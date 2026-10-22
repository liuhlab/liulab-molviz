/** The viewer. The build exposes each export here on the global `molviz`. */

import { declareFaces, drawLayout, drawRecord, type LiveDrawing } from "./draw";
import {
	type Drawing,
	fileDrawing,
	type Input,
	type Layout,
	type Still,
	stillDrawing,
	type Where,
} from "./drawing";
import { figureInput } from "./figure";
import { gelInput } from "./gel";
import { LIMIT } from "./options";
import { plateInput } from "./plate";
import { fontFaceCss } from "./text";
import { recordInput } from "./views";

/** A call that draws an input into an element of a page. */
type Draw = (
	element: Element,
	input: unknown,
	options?: unknown,
) => LiveDrawing;

/** An input's four calls by their names on the global. */
interface Names {
	/** The call that checks it. */
	readonly check: string;
	/** The one that draws it into an element. */
	readonly draw: string;
	/** The one that draws it as SVG text. */
	readonly svg: string;
	/** The one that draws it as a still SVG. */
	readonly still: string;
}

/**
 * One input in the table: its module's check and layout, its four calls' names, and the call
 * that draws it into an element when it has its own.
 */
interface Entry {
	readonly input: Input<unknown>;
	readonly calls: Names;
	readonly draw?: Draw;
}

/**
 * Each input by its name. A record draws into an element with its own call, which opens a frame
 * with its controls; any other draws the one scene its layout gives.
 */
const inputs = {
	record: {
		input: recordInput,
		calls: { check: "check", draw: "draw", svg: "svg", still: "stillSvg" },
		draw: drawRecord,
	},
	gel: {
		input: gelInput,
		calls: {
			check: "checkGel",
			draw: "drawGel",
			svg: "gelSvg",
			still: "gelStillSvg",
		},
	},
	plate: {
		input: plateInput,
		calls: {
			check: "checkPlate",
			draw: "drawPlate",
			svg: "plateSvg",
			still: "plateStillSvg",
		},
	},
	figure: {
		input: figureInput,
		calls: {
			check: "checkFigure",
			draw: "drawFigure",
			svg: "figureSvg",
			still: "figureStillSvg",
		},
	},
} as const satisfies { readonly [name: string]: Entry };

type Inputs = typeof inputs;

/** Each input's calls by their names on the global, by the input's name. */
export const calls = Object.fromEntries(
	Object.entries(inputs).map(([name, { calls }]) => [name, calls]),
) as { readonly [Name in keyof Inputs]: Inputs[Name]["calls"] };

/** Each input's four calls, by their names on the global. */
type Calls = {
	readonly [Name in keyof Inputs as Inputs[Name]["calls"]["check"]]: Inputs[Name]["input"]["check"];
} & {
	readonly [Name in keyof Inputs as Inputs[Name]["calls"]["draw"]]: Draw;
} & {
	readonly [Name in keyof Inputs as Inputs[Name]["calls"]["svg"]]: (
		input: unknown,
		options?: unknown,
	) => Drawing;
} & {
	readonly [Name in keyof Inputs as Inputs[Name]["calls"]["still"]]: (
		input: unknown,
		options?: unknown,
	) => Still;
};

const PAGE: Where = { page: true };
const FILE: Where = { page: false };

/** `given` checked as `input`, then laid out with `options` for `where`. */
function laidOut(
	input: Input<unknown>,
	given: unknown,
	options: unknown,
	where: Where,
): Layout {
	return input.layout(input.check(given), options, where);
}

/** Each input's four calls built from its entry, by their names on the global. */
function built(entries: readonly Entry[]): Calls {
	const made: { [name: string]: unknown } = {};
	for (const { input, calls, draw } of entries) {
		made[calls.check] = input.check;
		made[calls.draw] =
			draw ??
			((element: Element, given: unknown, options: unknown = {}) =>
				drawLayout(element, laidOut(input, given, options, PAGE)));
		made[calls.svg] = (given: unknown, options: unknown = {}) =>
			fileDrawing(laidOut(input, given, options, FILE));
		made[calls.still] = (given: unknown, options: unknown = {}) =>
			stillDrawing(laidOut(input, given, options, FILE));
	}
	return made as Calls;
}

// The build sets only named exports on the global, so each call is named again here. The input
// table's test checks that every name in `calls` is one; tsc checks that each is in `calls`.
export const {
	check,
	checkFigure,
	checkGel,
	checkPlate,
	draw,
	drawFigure,
	drawGel,
	drawPlate,
	figureStillSvg,
	figureSvg,
	gelStillSvg,
	gelSvg,
	plateStillSvg,
	plateSvg,
	stillSvg,
	svg,
} = built(Object.values(inputs));

export { declareFaces };

/** The font rules: the CSS a page writes once, in a `<style>`, for every still SVG it holds. */
export const fontRules = fontFaceCss;

/** The most bases of a span the sequence view draws. */
export const SEQUENCE_VIEW_LIMIT = LIMIT;
