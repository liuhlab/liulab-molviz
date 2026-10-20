/** Labels set above the line in a staircase, each on a leader down to what it names. */

import {
	GAP,
	hidingOrder,
	itemShapes,
	type Label,
	labelShapes,
	labelSize,
	SPACING,
} from "./labels";
import { LEADER, LEADER_WIDTH } from "./paint";
import type { Box, Shape } from "./scene";

/** How far above the line a box may reach, at any length of line, unless told otherwise. */
const RISE = 730;

/** A label's box, and the `x` its leader rises at. */
interface Sized {
	readonly width: number;
	readonly height: number;
	readonly x: number;
}

/** A label to set above the line, and where its leader rises from: the point (`x`, `foot`). */
export interface Anchored {
	readonly label: Label;
	readonly x: number;
	readonly foot: number;
}

/**
 * The shapes that set `anchored` above `top` with their leaders, no box reaching more than
 * `rise` above it; the box each label shown takes; and the labels left out to keep them there,
 * each once, in the order they hid. A label is listed only when it shows nowhere: at none of its
 * anchors, nor in `inPlace`, the labels shown on what they name. With `tips`, a label's shapes
 * and leader carry its tip.
 */
export function labelsAbove(
	anchored: readonly Anchored[],
	top: number,
	{
		rise = RISE,
		inPlace = [],
		tips = false,
	}: { rise?: number; inPlace?: readonly Label[]; tips?: boolean } = {},
): { shapes: Shape[]; boxes: Box[]; hidden: Label[] } {
	const sized = anchored.map(({ label, x }) => ({ ...labelSize(label), x }));
	const base = top - GAP;
	const order = [...anchored.keys()].sort((i, j) =>
		hidingOrder(anchored[i].label, anchored[j].label),
	);
	const gone = hide(sized, order, base, top - rise);
	const out = new Set(gone);
	const shown = anchored.filter((_, i) => !out.has(i));
	const placed = staircase(
		sized.filter((_, i) => !out.has(i)),
		base,
	).boxes;
	const shapes: Shape[] = [];
	for (const [i, { label, x, foot }] of shown.entries()) {
		const box = placed[i];
		const drawn: Shape[] = [
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
		];
		shapes.push(...(tips ? itemShapes(drawn, label) : drawn));
	}
	const somewhere = new Set([...inPlace, ...shown.map(({ label }) => label)]);
	const hidden = [...new Set(gone.map((i) => anchored[i].label))].filter(
		(label) => !somewhere.has(label),
	);
	return { shapes, boxes: placed, hidden };
}

/**
 * The labels to leave out so `staircase` sets the rest no higher than `ceiling`, in the order
 * they hid. `order` gives every label once, the first to hide first.
 *
 * A stack too tall is a box past the ceiling and the boxes it rests on, down to the line. Each
 * round lays the labels out and hides, of all the labels in such stacks, the first in `order`.
 * A label in none never hides.
 */
function hide(
	sized: readonly Sized[],
	order: readonly number[],
	base: number,
	ceiling: number,
): number[] {
	const rank: number[] = [];
	for (const [position, i] of order.entries()) rank[i] = position;
	const hidden = new Set<number>();
	const tall = () => {
		const kept = [...sized.keys()].filter((i) => !hidden.has(i));
		const { boxes, rests } = staircase(
			kept.map((i) => sized[i]),
			base,
		);
		const stacked = new Set<number>();
		for (const [k, box] of boxes.entries()) {
			if (box.y >= ceiling) continue;
			for (let on: number | undefined = k; on !== undefined; on = rests[on]) {
				stacked.add(kept[on]);
			}
		}
		return stacked;
	};
	for (let stacked = tall(); stacked.size > 0; stacked = tall()) {
		hidden.add([...stacked].reduce((a, b) => (rank[a] < rank[b] ? a : b)));
	}
	return [...hidden].sort((i, j) => rank[i] - rank[j]);
}

/**
 * Place boxes in rows above `base`, each over the point `x` its leader rises from, so close
 * neighbours rise in a staircase and no leader crosses another box. `rests` gives, for each box,
 * the box under it that sets its height, the one nearest its `x` where two do, or nothing on the
 * lowest row.
 *
 * Boxes are placed from the right. A box hangs right from its `x`, just above every box already
 * placed that it meets. It hangs left instead where that puts it lower and it reaches no other
 * `x`, so a box beside a crowd is not lifted over it.
 */
function staircase(
	sized: readonly Sized[],
	base: number,
): { boxes: Box[]; rests: (number | undefined)[] } {
	const xs = sized.map((one) => one.x);
	const ordered = [...xs].sort((a, b) => a - b);
	// Each box placed: its index, its left edge, its right edge and `SPACING` beyond, and the
	// lowest a box above it may end.
	const taken: [number, number, number, number][] = [];
	const meets = (left: number, width: number) =>
		taken.filter(([, from, to]) => from < left + width + SPACING && left < to);
	const bottom = (left: number, width: number) =>
		Math.min(base, ...meets(left, width).map(([, , , under]) => under));
	const boxes: Box[] = new Array(sized.length);
	const rests: (number | undefined)[] = new Array(sized.length);
	const order = [...sized.keys()].sort((i, j) => xs[j] - xs[i] || i - j);
	for (const i of order) {
		const { width, height, x } = sized[i];
		const right = bottom(x, width);
		const near = ordered.filter(
			(other) => x - width - SPACING <= other && other <= x,
		);
		const left = near.length <= 1 ? bottom(x - width, width) : right;
		const [low, from] = left > right ? [left, x - width] : [right, x];
		const away = ({ x: start, width: span }: Box) =>
			Math.max(0, start - x, x - start - span);
		rests[i] = meets(from, width)
			.flatMap(([j, , , under]) => (under === low ? [j] : []))
			.sort((a, b) => away(boxes[a]) - away(boxes[b]))[0];
		taken.push([i, from, from + width + SPACING, low - height - SPACING]);
		boxes[i] = { x: from, y: low - height, width, height };
	}
	return { boxes, rests };
}
