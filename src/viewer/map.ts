/**
 * What the circle and the line share: the backbone, the ruler's ticks, the title, the margin, the
 * hidden-label notice's place, and where each sets the bases, in points, x to the right and y down.
 */

import { type Label, noticeShapes, SMALL_SIZE } from "./labels";
import { INK } from "./paint";
import type { Span } from "./record";
import type { Box, PathCommand, Shape } from "./scene";
import { baseline, type Face, height } from "./text";

/** The line's length, unless a layout is given another. */
export const WIDTH = 720;

/** How far an insertion's bar reaches past the backbone either side. */
export const INSERTION_REACH = 1.5;

// The backbone: each strand's line, and how far apart they are.
export const BACKBONE = 2.6;
export const STRANDS_APART = 3.8;

// The ruler's ticks, the origin's tick, and how far a number keeps from another and from the
// origin's tick.
export const TICK = 6;
export const TICK_WIDTH = 1.2;
export const ORIGIN_TICK = 12;
export const ORIGIN_TICK_WIDTH = 2.4;
export const CLEAR = 10;
/** The most numbers the ruler gives along each `WIDTH` points of the line. */
const NUMBERS = 10;

/** The size of the record's name. */
export const NAME_SIZE = 13.5;

/** The room left around everything a record's drawing covers. */
export const MARGIN = 16;

/**
 * The least of 1, 2 or 5 times a power of ten that gives at most `NUMBERS` numbers along each
 * `WIDTH` points of a line `width` long drawing `bases`.
 */
export function tickStep(bases: number, width = WIDTH): number {
	for (let power = 1; ; power *= 10) {
		for (const factor of [1, 2, 5]) {
			if (factor * power * NUMBERS * width >= bases * WIDTH) {
				return factor * power;
			}
		}
	}
}

/** One line of a title: its text, face and size. */
export type TitleLine = readonly [text: string, face: Face, size: number];

/** A title's lines: each of `names` in bold, then `under`. */
export function titleLines(
	names: readonly string[],
	under: string,
): TitleLine[] {
	return [
		...names.map((text): TitleLine => [text, "sans-bold", NAME_SIZE]),
		[under, "sans", SMALL_SIZE],
	];
}

/** `lines` set one under another from `top`, each centred on `x`. */
export function titleShapes(
	lines: readonly TitleLine[],
	x: number,
	top: number,
): Shape[] {
	const shapes: Shape[] = [];
	let y = top;
	for (const [text, face, size] of lines) {
		const h = height(face, size);
		shapes.push({
			shape: "text",
			text,
			face,
			size,
			x,
			y: baseline(face, size, y + h / 2),
			anchor: "middle",
			fill: INK,
		});
		y += h;
	}
	return shapes;
}

/** The notice counting `hidden`, under the corner of `covered`, a drawing with `MARGIN` round it. */
export function noticeUnder(hidden: readonly Label[], covered: Box): Shape[] {
	return noticeShapes(
		hidden,
		covered.x + covered.width - MARGIN,
		covered.y + covered.height - MARGIN,
	);
}

/** Where the line sets the bases, and the highest and lowest its marks reach. */
export interface LineGeometry {
	readonly map: "line";
	/** The positions drawn, counted as the span counts. */
	readonly span: Span;
	/** The line's length. */
	readonly width: number;
	readonly top: number;
	readonly bottom: number;
}

/** Where the circle sets the bases round (0, 0), and the nearest and farthest its marks reach. */
export interface CircleGeometry {
	readonly map: "circle";
	readonly length: number;
	/** The backbone's radius. */
	readonly radius: number;
	/** The angle of the origin, in radians clockwise from the top. */
	readonly turn: number;
	readonly inner: number;
	readonly outer: number;
}

/** Where a map sets the bases. */
export type MapGeometry = LineGeometry | CircleGeometry;

/** The x of `position`, counted as the span counts. */
export function lineX(
	{ span, width }: Pick<LineGeometry, "span" | "width">,
	position: number,
): number {
	return ((position - span.start) * width) / (span.end - span.start);
}

/** The angle of `position`, in radians clockwise from the top. */
export function angleOf(
	position: number,
	{ length, turn }: Pick<CircleGeometry, "length" | "turn">,
): number {
	return (2 * Math.PI * position) / length + turn;
}

/** The point `radius` from the centre at `angle`. */
export function pointAt(radius: number, angle: number): [number, number] {
	return [radius * Math.sin(angle), -radius * Math.cos(angle)];
}

/**
 * An arc on `radius` from `start` to `end`, in pieces of less than a half turn, from the point
 * at `start`, which the path is already at.
 */
export function arc(radius: number, start: number, end: number): PathCommand[] {
	if (end === start) return [];
	const parts = Math.ceil(Math.abs(end - start) / Math.PI + 1e-9);
	const sweep = end > start ? 1 : 0;
	return Array.from({ length: parts }, (_, i) => {
		const [x, y] = pointAt(radius, start + ((end - start) * (i + 1)) / parts);
		return ["A", radius, 0, sweep, x, y] as const;
	});
}
