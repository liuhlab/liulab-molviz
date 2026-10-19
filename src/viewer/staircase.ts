/** Labels set above the line in a staircase, each on a leader down to what it names. */

import { GAP, type Label, labelShapes, labelSize } from "./labels";
import { LEADER } from "./paint";
import type { Box, Shape } from "./scene";

/** The room between two boxes. */
const SPACING = 2;
const LEADER_WIDTH = 0.8;

/** A label to set above the line, and where its leader rises from: the point (`x`, `foot`). */
export interface Anchored {
	readonly label: Label;
	readonly x: number;
	readonly foot: number;
}

/**
 * The shapes that set `anchored` above `top` with their leaders, and the labels left out to
 * keep them clear of one another.
 */
export function labelsAbove(
	anchored: readonly Anchored[],
	top: number,
): { shapes: Shape[]; hidden: Label[] } {
	const sized = anchored.map(({ label, x }) => ({ ...labelSize(label), x }));
	const placed = staircase(sized, top - GAP);
	const shapes: Shape[] = [];
	for (const [i, { label, x, foot }] of anchored.entries()) {
		const box = placed[i];
		shapes.push(
			{
				shape: "line",
				x1: x,
				y1: foot,
				x2: x,
				y2: box.y + box.height,
				stroke: LEADER,
				strokeWidth: LEADER_WIDTH,
			},
			...labelShapes(label, box),
		);
	}
	return { shapes, hidden: [] };
}

/**
 * Place boxes in rows above `base`, each over the point `x` its leader rises from, so close
 * neighbours rise in a staircase and no leader crosses another box.
 *
 * Boxes are placed from the right. A box hangs right from its `x`, just above every box already
 * placed that it meets. It hangs left instead where that puts it lower and it reaches no other
 * `x`, so a box beside a crowd is not lifted over it.
 */
function staircase(
	sized: readonly { width: number; height: number; x: number }[],
	base: number,
): Box[] {
	const xs = sized.map((one) => one.x);
	const ordered = [...xs].sort((a, b) => a - b);
	// Each box placed: its left edge, its right edge and `SPACING` beyond, and the lowest a box
	// above it may end.
	const taken: [number, number, number][] = [];
	const bottom = (left: number, width: number) => {
		const right = left + width + SPACING;
		let low = base;
		for (const [from, to, under] of taken) {
			if (from < right && left < to) low = Math.min(low, under);
		}
		return low;
	};
	const placed: Box[] = new Array(sized.length);
	const order = [...sized.keys()].sort((i, j) => xs[j] - xs[i] || i - j);
	for (const i of order) {
		const { width, height, x } = sized[i];
		const right = bottom(x, width);
		const near = ordered.filter(
			(other) => x - width - SPACING <= other && other <= x,
		);
		const left = near.length <= 1 ? bottom(x - width, width) : right;
		const [low, from] = left > right ? [left, x - width] : [right, x];
		taken.push([from, from + width + SPACING, low - height - SPACING]);
		placed[i] = { x: from, y: low - height, width, height };
	}
	return placed;
}
