/**
 * A scene: a drawing laid out as shapes and text in points, x to the right and y down, with no
 * SVG or DOM in it.
 */

import type { Face } from "./text";

/** A rectangle: its top-left corner, width and height. */
export interface Box {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** One step of a path, in points. */
export type PathCommand =
	| readonly ["M" | "L", x: number, y: number]
	| readonly [
			"A",
			radius: number,
			large: 0 | 1,
			sweep: 0 | 1,
			x: number,
			y: number,
	  ]
	| readonly ["Z"];

/** One thing a scene draws. Lengths are in points; colours are written `#rrggbb`. */
export type Shape = (
	| {
			readonly shape: "line";
			readonly x1: number;
			readonly y1: number;
			readonly x2: number;
			readonly y2: number;
			readonly stroke: string;
			readonly strokeWidth: number;
	  }
	| {
			readonly shape: "polygon";
			readonly points: readonly (readonly [x: number, y: number])[];
			readonly fill: string;
			readonly stroke: string;
			readonly strokeWidth: number;
	  }
	| {
			readonly shape: "path";
			readonly commands: readonly PathCommand[];
			readonly fill: string;
			readonly stroke: string;
			readonly strokeWidth: number;
	  }
	| {
			readonly shape: "rect";
			readonly x: number;
			readonly y: number;
			readonly width: number;
			readonly height: number;
			/** The radius of its rounded corners. */
			readonly corner: number;
			readonly fill: string;
			readonly stroke: string;
			readonly strokeWidth: number;
	  }
	| {
			readonly shape: "circle";
			readonly cx: number;
			readonly cy: number;
			readonly r: number;
			readonly fill: string;
	  }
	| {
			readonly shape: "text";
			readonly text: string;
			readonly face: Face;
			readonly size: number;
			/** Where the text starts, or its middle, as `anchor` says. */
			readonly x: number;
			/** The baseline. */
			readonly y: number;
			readonly anchor: "start" | "middle";
			readonly fill: string;
			/** If given, each letter sits centred in a cell this wide, the cells side by side. */
			readonly cell?: number;
	  }
) & {
	/** What a page shows while the pointer rests on the shape. A file leaves it out. */
	readonly hover?: string;
};

/** A drawing laid out: its shapes in the order they are drawn. */
export interface Scene {
	/** What the drawing covers, its margin included. */
	readonly extent: Box;
	readonly shapes: readonly Shape[];
}

/** Where a line of text `width` wide starts, from its `x` and its `anchor`. */
export function leftEdge(
	{ x, anchor }: { readonly x: number; readonly anchor: "start" | "middle" },
	width: number,
): number {
	return anchor === "middle" ? x - width / 2 : x;
}

/** `value` with two decimals, and never as `-0.00`, so the same scene writes the same text. */
export function twoDecimals(value: number): string {
	const text = value.toFixed(2);
	return text === "-0.00" ? "0.00" : text;
}
