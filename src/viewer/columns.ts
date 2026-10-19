/**
 * SnapGene's label columns round a circle centred on (0, 0), in points, x to the right and y down.
 *
 * Labels go in two columns, right and left of the circle, in the order their anchors run
 * clockwise from the top. Each column is spread to the nearest heights, in least squares, at
 * which no two boxes overlap. Each box's inner edge touches an ellipse round the circle, and a
 * straight leader runs from its anchor to that edge. The ellipse grows until each column fits
 * beside it and no leader enters the circle.
 *
 * No box overlaps the circle, since every box lies outside the ellipse. A leader to the point
 * where its box touches the ellipse stays inside the ellipse, where no box is, so it crosses
 * none; a leader meets its box nearer halfway up only where it crosses no other box either.
 *
 * A crowd is a run of labels a column packs against one another. While a crowd reaches past
 * the reach above or below the centre, the first of its labels in the caller's order hides and the
 * column is spread again. A label in no such crowd never hides.
 */

import type { Box } from "./scene";

/** How far above or below the centre a box may reach, by default, before labels hide. */
export const REACH = 390;

/** How far beyond the circle the ellipse starts. */
const GAP = 14;
/** The least room between two boxes in a column. */
const SPACING = 2;
/** The least room between a box and the vertical line through the centre. */
const MARGIN = 3;
/** How much the ellipse grows each time a column does not fit or a leader enters the circle. */
const GROWTH = 1.04;
/** How many heights, from halfway up a box towards its touching point, a leader tries. */
const STEPS = 4;

/** A point, in points. */
export interface Point {
	readonly x: number;
	readonly y: number;
}

/** A label to place: its box's size, and the point its leader starts from. */
export interface Anchored {
	readonly width: number;
	readonly height: number;
	readonly anchor: Point;
}

/** Where a label went: its box, and its leader from the anchor to the box's inner edge. */
export interface Placed {
	readonly box: Box;
	readonly leader: readonly [Point, Point];
}

/** The labels placed, and those hidden. */
export interface Columns {
	/** Each label's place, in the order given, or `null` where it hid. */
	readonly placed: readonly (Placed | null)[];
	/** The labels hidden, by index, in `order`. */
	readonly hidden: readonly number[];
}

/**
 * Place `labels` in two columns round the circle of `radius`, hiding labels while a crowd
 * reaches past `reach` above or below the centre.
 *
 * Each anchor lies outside the circle and less than `GAP` beyond it. `order` holds every
 * label's index once, the first to hide first.
 */
export function columns(
	labels: readonly Anchored[],
	order: readonly number[],
	radius: number,
	reach = REACH,
): Columns {
	const hidden = hide(labels, order, radius, reach);
	const gone = new Set(hidden);
	const shown = labels.flatMap((_, i) => (gone.has(i) ? [] : [i]));
	const places = place(
		shown.map((i) => labels[i]),
		radius,
	);
	const placed: (Placed | null)[] = labels.map(() => null);
	shown.forEach((i, k) => {
		placed[i] = places[k];
	});
	return { placed, hidden };
}

/** The labels to hide so the rest lie within `reach`, in `order`. */
function hide(
	labels: readonly Anchored[],
	order: readonly number[],
	radius: number,
	reach: number,
): number[] {
	const rank: number[] = [];
	order.forEach((i, position) => {
		rank[i] = position;
	});
	const hidden: number[] = [];
	for (const column of sides(labels)) {
		let shown = column;
		for (;;) {
			const { middles, crowds } = spreadOut(shown, labels, radius + GAP);
			const at: number[] = [];
			shown.forEach((i, k) => {
				at[i] = middles[k];
			});
			const over = crowds
				.filter((crowd) =>
					crowd.some((j) => Math.abs(at[j]) + labels[j].height / 2 > reach),
				)
				.flat();
			if (over.length === 0) break;
			const first = over.reduce((a, b) => (rank[b] < rank[a] ? b : a));
			shown = shown.filter((i) => i !== first);
			hidden.push(first);
		}
	}
	return hidden.sort((a, b) => rank[a] - rank[b]);
}

/** Place every label, as `columns` does, hiding none. */
function place(labels: readonly Anchored[], radius: number): Placed[] {
	const start = radius + GAP;
	const [right, left] = sides(labels);
	const middles: number[] = new Array(labels.length);
	for (const column of [right, left]) {
		const spread = spreadOut(column, labels, start).middles;
		column.forEach((i, k) => {
			middles[i] = spread[k];
		});
	}
	const nearest = labels.map((label, i) => nearestHeight(label, middles[i]));
	let a = start;
	let b = start;
	for (;;) {
		// A box level with the ellipse's top or bottom would reach the other column.
		if (nearest.some((near) => near ** 2 >= b * b * (1 - (MARGIN / a) ** 2))) {
			b *= GROWTH;
			continue;
		}
		const placed: Placed[] = new Array(labels.length);
		for (const [column, side] of [
			[right, 1],
			[left, -1],
		] as const) {
			const boxes = new Map<number, Box>();
			for (const i of column) {
				const { width, height } = labels[i];
				const inner = side * a * Math.sqrt(1 - (nearest[i] / b) ** 2);
				const x = side > 0 ? inner : inner - width;
				boxes.set(i, { x, y: middles[i] - height / 2, width, height });
			}
			for (const [i, box] of boxes) {
				const others = [...boxes].filter(([j]) => j !== i).map(([, o]) => o);
				const { anchor } = labels[i];
				const end = port(anchor, box, others, nearest[i], side, radius, a, b);
				placed[i] = { box, leader: [anchor, end] };
			}
		}
		if (!placed.some(({ leader }) => enters(leader, radius))) return placed;
		a *= GROWTH;
	}
}

/** The right column's labels and the left's, each from the top down. */
function sides(labels: readonly Anchored[]): [number[], number[]] {
	const angles = labels.map(({ anchor }) => clockwise(anchor));
	const indices = labels.map((_, i) => i);
	const right = indices
		.filter((i) => angles[i] < Math.PI)
		.sort((i, j) => angles[i] - angles[j]);
	const left = indices
		.filter((i) => angles[i] >= Math.PI)
		.sort((i, j) => angles[j] - angles[i]);
	return [right, left];
}

/** The angle of `point` about the centre, clockwise from the top, in [0, 2π). */
function clockwise({ x, y }: Point): number {
	const angle = Math.atan2(x, -y);
	return angle < 0 ? angle + 2 * Math.PI : angle;
}

/**
 * The middles nearest their anchors' heights, in least squares, keeping boxes apart, and the
 * crowds of labels packed against one another.
 *
 * Each box's target is its anchor's angle carried out to `start`. Taking off each box's least
 * offset from the first makes this isotonic regression, which pooling adjacent violators solves
 * exactly; the pools are the crowds.
 */
function spreadOut(
	column: readonly number[],
	labels: readonly Anchored[],
	start: number,
): { middles: number[]; crowds: number[][] } {
	const offsets = [0];
	for (let k = 1; k < column.length; k++) {
		const above = labels[column[k - 1]].height;
		const below = labels[column[k]].height;
		offsets.push(offsets[k - 1] + (above + below) / 2 + SPACING);
	}
	const pools: { total: number; count: number }[] = [];
	column.forEach((i, k) => {
		const target = -start * Math.cos(clockwise(labels[i].anchor));
		pools.push({ total: target - offsets[k], count: 1 });
		while (pools.length > 1) {
			const last = pools[pools.length - 1];
			const before = pools[pools.length - 2];
			if (before.total / before.count <= last.total / last.count) break;
			pools.pop();
			before.total += last.total;
			before.count += last.count;
		}
	});
	const middles: number[] = [];
	const crowds: number[][] = [];
	for (const { total, count } of pools) {
		const first = middles.length;
		for (let k = first; k < first + count; k++)
			middles.push(total / count + offsets[k]);
		crowds.push(column.slice(first, first + count));
	}
	return { middles, crowds };
}

/** The height, within a box whose middle is at `middle`, nearest the centre's. */
function nearestHeight({ height }: Anchored, middle: number): number {
	return Math.min(Math.max(0, middle - height / 2), middle + height / 2);
}

/**
 * Where a leader meets its box's inner edge: as near halfway up as keeps it out of the circle
 * and off every other box, else the point touching the ellipse, which always does.
 */
function port(
	anchor: Point,
	box: Box,
	others: readonly Box[],
	near: number,
	side: number,
	radius: number,
	a: number,
	b: number,
): Point {
	const x = side > 0 ? box.x : box.x + box.width;
	const middle = box.y + box.height / 2;
	for (let step = 0; step < STEPS; step++) {
		const end = { x, y: middle + ((near - middle) * step) / STEPS };
		const leaving = leaves(anchor, end, a, b);
		const low = Math.min(leaving, end.y);
		const high = Math.max(leaving, end.y);
		if (
			!enters([anchor, end], radius) &&
			!others.some(
				(o) => o.y < high && low < o.y + o.height && crosses([anchor, end], o),
			)
		)
			return end;
	}
	return { x, y: near };
}

/** The height at which a segment from a point inside the ellipse leaves it. */
function leaves(inside: Point, outside: Point, a: number, b: number): number {
	const dx = outside.x - inside.x;
	const dy = outside.y - inside.y;
	const qa = (dx / a) ** 2 + (dy / b) ** 2;
	const qb = 2 * ((inside.x * dx) / a ** 2 + (inside.y * dy) / b ** 2);
	const qc = (inside.x / a) ** 2 + (inside.y / b) ** 2 - 1;
	if (qa === 0) return inside.y;
	const t = (-qb + Math.sqrt(Math.max(0, qb * qb - 4 * qa * qc))) / (2 * qa);
	return inside.y + Math.min(t, 1) * dy;
}

/** Whether the segment passes through the inside of `box`. */
function crosses([from, to]: readonly [Point, Point], box: Box): boolean {
	let low = 0;
	let high = 1;
	for (const [p, q] of [
		[from.x - to.x, from.x - box.x],
		[to.x - from.x, box.x + box.width - from.x],
		[from.y - to.y, from.y - box.y],
		[to.y - from.y, box.y + box.height - from.y],
	]) {
		if (p === 0) {
			if (q <= 0) return false;
		} else if (p < 0) low = Math.max(low, q / p);
		else high = Math.min(high, q / p);
	}
	return low < high;
}

/** Whether the segment comes nearer the centre than `radius`. */
function enters([from, to]: readonly [Point, Point], radius: number): boolean {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const length = dx * dx + dy * dy;
	const t =
		length === 0
			? 0
			: Math.min(1, Math.max(0, -(from.x * dx + from.y * dy) / length));
	return Math.hypot(from.x + t * dx, from.y + t * dy) < radius;
}
