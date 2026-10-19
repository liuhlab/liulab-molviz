/**
 * Where each view sets the bases, in the points it is laid out in: a position to a point and a
 * point back to the base under it.
 */

import type { Span } from "./record";
import { CELL, type RowBox } from "./sequence";

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

/** The x of `position`, counted as the span counts. */
export function lineX(
	{ span, width }: Pick<LineGeometry, "span" | "width">,
	position: number,
): number {
	return ((position - span.start) * width) / (span.end - span.start);
}

/** The base at `x`, counted as the span counts, or the span's nearest past either end. */
export function lineBase({ span, width }: LineGeometry, x: number): number {
	const { start, end } = span;
	const base = start + Math.floor((x * (end - start)) / width);
	return Math.min(Math.max(base, start), end - 1);
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

/** The base at the point (`x`, `y`), counted from the origin, at any distance from the centre. */
export function circleBase(
	{ length, turn }: CircleGeometry,
	x: number,
	y: number,
): number {
	const turns = (Math.atan2(x, -y) - turn) / (2 * Math.PI);
	return Math.min(Math.floor((turns - Math.floor(turns)) * length), length - 1);
}

/** The row of `rows` holding `position`, counted as the span counts, or `null`. */
export function rowHolding(
	rows: readonly RowBox[],
	position: number,
): RowBox | null {
	return (
		rows.find((row) => row.start <= position && position < row.end) ?? null
	);
}

/** The x of `position` in `row`, counted as the span counts. */
export function rowX(row: RowBox, position: number): number {
	return (position - row.start) * CELL;
}

/**
 * The base at (`x`, `y`) in `rows`, counted as the span counts: `null` off the strands, or with
 * `near` the nearest base in the last row starting above it. Without `bottom` the strands end at
 * the rail.
 */
export function rowBase(
	rows: readonly RowBox[],
	x: number,
	y: number,
	{ near = false, bottom = true } = {},
): number | null {
	const above = rows.findLastIndex((row) => row.strands.top[0] <= y);
	const { start, end, strands } = rows[Math.max(above, 0)];
	const foot = bottom && strands.bottom ? strands.bottom[1] : strands.rail;
	const index = Math.floor(x / CELL);
	const count = end - start;
	if (
		!near &&
		(y < strands.top[0] || y > foot || index < 0 || index >= count)
	) {
		return null;
	}
	return start + Math.min(Math.max(index, 0), count - 1);
}
