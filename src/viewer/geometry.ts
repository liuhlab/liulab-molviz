/**
 * Where each view sets the bases, in the points it is laid out in: a position to a point, a point
 * back to the base under it, and a selection shaded.
 */

import { SHADING, SHADING_EDGE, SHADING_EDGE_WIDTH } from "./paint";
import { type Piece, pieces } from "./pieces";
import type { Bounds, Span } from "./record";
import type { PathCommand, Shape } from "./scene";
import { CELL, type RowBox, type Strands } from "./sequence";

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

/** Where a map sets the bases. */
export type MapGeometry = LineGeometry | CircleGeometry;

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
	const pieces = Math.ceil(Math.abs(end - start) / Math.PI + 1e-9);
	const sweep = end > start ? 1 : 0;
	return Array.from({ length: pieces }, (_, i) => {
		const [x, y] = pointAt(radius, start + ((end - start) * (i + 1)) / pieces);
		return ["A", radius, 0, sweep, x, y] as const;
	});
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
	const foot = footOf(strands, bottom);
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

/** `span` shaded on the line from its top to its bottom, edged at each end the line shows. */
export function lineShading(
	line: LineGeometry,
	bounds: Bounds,
	span: Span,
): Shape[] {
	return within(span, line.span, bounds).flatMap((piece) =>
		shaded(
			lineX(line, piece.start),
			lineX(line, piece.end),
			[line.top, line.bottom],
			piece,
		),
	);
}

/** `span` shaded on the circle from its inner radius to its outer, edged at each end. */
export function circleShading(circle: CircleGeometry, span: Span): Shape[] {
	const { inner, outer } = circle;
	const start = angleOf(span.start, circle);
	const end = angleOf(span.end, circle);
	return [
		{
			shape: "path",
			commands: [
				["M", ...pointAt(outer, start)],
				...arc(outer, start, end),
				["L", ...pointAt(inner, end)],
				...arc(inner, end, start),
				["Z"],
			],
			fill: SHADING,
			stroke: "none",
			strokeWidth: 0,
		},
		...[start, end].map((angle) =>
			edge(pointAt(inner, angle), pointAt(outer, angle)),
		),
	];
}

/**
 * `span` shaded on each row of `rows` holding part of it, over the strands, edged at each end the
 * rows show. Without `bottom` the shading ends at the rail.
 */
export function rowShading(
	rows: readonly RowBox[],
	bounds: Bounds,
	span: Span,
	{ bottom = true } = {},
): Shape[] {
	const drawn = { start: rows[0].start, end: (rows.at(-1) as RowBox).end };
	return within(span, drawn, bounds).flatMap((piece) =>
		rows
			.filter((row) => row.start < piece.end && piece.start < row.end)
			.flatMap((row) => {
				const { strands } = row;
				return shaded(
					rowX(row, Math.max(piece.start, row.start)),
					rowX(row, Math.min(piece.end, row.end)),
					[strands.top[0], footOf(strands, bottom)],
					{
						starts: piece.starts && piece.start >= row.start,
						ends: piece.ends && piece.end <= row.end,
					},
				);
			}),
	);
}

/** Where a row's bases end: under the bottom strand, or at the rail without `bottom`. */
function footOf(strands: Strands, bottom: boolean): number {
	return bottom && strands.bottom ? strands.bottom[1] : strands.rail;
}

/** What of `span` lies in `drawn`, counted as `drawn` counts. */
function within(span: Span, drawn: Span, bounds: Bounds): Piece[] {
	return pieces([{ ...span, color: SHADING }], drawn, bounds);
}

/** A box shaded from `left` to `right`, with an edge where the selection `starts` and `ends`. */
function shaded(
	left: number,
	right: number,
	[top, bottom]: readonly [number, number],
	{ starts, ends }: Pick<Piece, "starts" | "ends">,
): Shape[] {
	const shapes: Shape[] = [
		{
			shape: "rect",
			x: left,
			y: top,
			width: right - left,
			height: bottom - top,
			corner: 0,
			fill: SHADING,
			stroke: "none",
			strokeWidth: 0,
		},
	];
	if (starts) shapes.push(edge([left, top], [left, bottom]));
	if (ends) shapes.push(edge([right, top], [right, bottom]));
	return shapes;
}

function edge(
	[x1, y1]: readonly [number, number],
	[x2, y2]: readonly [number, number],
): Shape {
	return {
		shape: "line",
		x1,
		y1,
		x2,
		y2,
		stroke: SHADING_EDGE,
		strokeWidth: SHADING_EDGE_WIDTH,
	};
}
