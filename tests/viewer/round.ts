/** Checks on boxes and segments, and on a drawing round a circle centred on (0, 0). */

import type { Box } from "../../src/viewer/scene";

/** How far two shapes may reach into each other and still count as touching. */
export const TOUCH = 1e-6;

/** A line from one point to another. */
export type Segment = readonly [
	{ readonly x: number; readonly y: number },
	{ readonly x: number; readonly y: number },
];

export function overlap(one: Box, other: Box): boolean {
	return (
		one.x < other.x + other.width - TOUCH &&
		other.x < one.x + one.width - TOUCH &&
		one.y < other.y + other.height - TOUCH &&
		other.y < one.y + one.height - TOUCH
	);
}

/** How near the centre any point of `box` comes. */
export function nearestToCentre(box: Box): number {
	const dx = Math.max(box.x, 0, -(box.x + box.width));
	const dy = Math.max(box.y, 0, -(box.y + box.height));
	return Math.hypot(dx, dy);
}

/** How near the centre any point of the segment comes. */
export function closestToCentre([from, to]: Segment): number {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const t = Math.min(
		1,
		Math.max(0, -(from.x * dx + from.y * dy) / (dx * dx + dy * dy || 1)),
	);
	return Math.hypot(from.x + t * dx, from.y + t * dy);
}

/** Whether the segment passes through the box's inside, by clipping it to the box. */
export function crosses([from, to]: Segment, box: Box): boolean {
	let low = 0;
	let high = 1;
	for (const [p, q] of [
		[from.x - to.x, from.x - (box.x + TOUCH)],
		[to.x - from.x, box.x + box.width - TOUCH - from.x],
		[from.y - to.y, from.y - (box.y + TOUCH)],
		[to.y - from.y, box.y + box.height - TOUCH - from.y],
	]) {
		if (p === 0) {
			if (q < 0) return false;
		} else if (p < 0) low = Math.max(low, q / p);
		else high = Math.min(high, q / p);
	}
	return low < high;
}
