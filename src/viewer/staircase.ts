/** Labels set above the line in a staircase, each on a leader down to what it names. */

import { GAP, hidingOrder, type Label, labelShapes, labelSize } from "./labels";
import { LEADER } from "./paint";
import type { Box, Shape } from "./scene";

/** The room between two boxes. */
const SPACING = 2;
const LEADER_WIDTH = 0.8;

/** How far above the drawing a box may reach, at any length of line. */
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
 * `RISE` above it; the box each label shown takes; and the labels left out to keep them there,
 * each once, in the order they hid.
 */
export function labelsAbove(
	anchored: readonly Anchored[],
	top: number,
): { shapes: Shape[]; boxes: Box[]; hidden: Label[] } {
	const sized = anchored.map(({ label, x }) => ({ ...labelSize(label), x }));
	const base = top - GAP;
	const order = [...anchored.keys()].sort((i, j) =>
		hidingOrder(anchored[i].label, anchored[j].label),
	);
	const gone = hide(sized, order, base, top - RISE);
	const out = new Set(gone);
	const shown = anchored.filter((_, i) => !out.has(i));
	const placed = staircase(
		sized.filter((_, i) => !out.has(i)),
		base,
	);
	const shapes: Shape[] = [];
	for (const [i, { label, x, foot }] of shown.entries()) {
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
	const hidden = [...new Set(gone.map((i) => anchored[i].label))];
	return { shapes, boxes: placed, hidden };
}

/**
 * The labels to leave out so `staircase` sets the rest no higher than `ceiling`, in the order
 * they hid. `order` gives every label once, the first to hide first.
 *
 * Labels can lift each other only when their `x`s lie closer than their widths and `SPACING`
 * added up, and a crowd is a run of labels linked so. A crowd under the ceiling hides nothing.
 * One past it hides the fewest of its labels, taken in order, that bring it under, unless it
 * breaks apart first: then it hides what breaks it, and each part is a crowd of its own.
 */
function hide(
	sized: readonly Sized[],
	order: readonly number[],
	base: number,
	ceiling: number,
): number[] {
	const rank: number[] = [];
	for (const [position, i] of order.entries()) rank[i] = position;
	const fits = (indices: readonly number[]) =>
		staircase(
			indices.map((i) => sized[i]),
			base,
		).every((box) => box.y >= ceiling);
	const hidden: number[] = [];
	const pending = crowds(sized, [...sized.keys()]);
	while (pending.length > 0) {
		const crowd = pending.pop() ?? [];
		if (fits(crowd)) continue;
		const ranked = [...crowd].sort((i, j) => rank[i] - rank[j]);
		const rest = (count: number) => {
			const gone = new Set(ranked.slice(0, count));
			return crowd.filter((i) => !gone.has(i));
		};
		const apart = (count: number) => crowds(sized, rest(count)).length > 1;
		// Hiding more of a crowd almost never lifts the rest, so halving finds how many to hide;
		// the count it finds always fits.
		const least = fewest(0, ranked.length, (count) => fits(rest(count)));
		if (!apart(least - 1)) {
			hidden.push(...ranked.slice(0, least));
			continue;
		}
		const breaks = fewest(0, least - 1, apart);
		hidden.push(...ranked.slice(0, breaks));
		pending.push(...crowds(sized, rest(breaks)));
	}
	return hidden.sort((i, j) => rank[i] - rank[j]);
}

/**
 * `indices` split into crowds along the line, each in increasing order. A box hangs within its
 * width of its `x`, so two labels further apart than their widths and `SPACING` never meet.
 */
function crowds(
	sized: readonly Sized[],
	indices: readonly number[],
): number[][] {
	const reaches = indices
		.map((i) => [sized[i].x - sized[i].width - SPACING / 2, i] as const)
		.sort(([a, i], [b, j]) => a - b || i - j);
	const found: number[][] = [];
	let end = Number.NEGATIVE_INFINITY;
	for (const [left, i] of reaches) {
		if (left >= end) found.push([]);
		found[found.length - 1].push(i);
		end = Math.max(end, sized[i].x + sized[i].width + SPACING / 2);
	}
	return found.map((crowd) => crowd.sort((a, b) => a - b));
}

/** The least count above `low`, and at most `high`, that `holds` for, where it fails at `low`. */
function fewest(
	low: number,
	high: number,
	holds: (count: number) => boolean,
): number {
	let [failing, holding] = [low, high];
	while (holding - failing > 1) {
		const middle = Math.floor((failing + holding) / 2);
		if (holds(middle)) holding = middle;
		else failing = middle;
	}
	return holding;
}

/**
 * Place boxes in rows above `base`, each over the point `x` its leader rises from, so close
 * neighbours rise in a staircase and no leader crosses another box.
 *
 * Boxes are placed from the right. A box hangs right from its `x`, just above every box already
 * placed that it meets. It hangs left instead where that puts it lower and it reaches no other
 * `x`, so a box beside a crowd is not lifted over it.
 */
function staircase(sized: readonly Sized[], base: number): Box[] {
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
