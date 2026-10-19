/** Where an item lies along a span, counted as the span counts, and as a reader reads it. */

import type { Bounds, Span } from "./record";

/** What of a feature lies in the span: part of a segment, or of a gap between two. */
export interface Piece {
	/** Where it lies, counted as the span counts. */
	readonly start: number;
	readonly end: number;
	/** The colour of its segment, or `null` for part of a gap. */
	readonly color: string | null;
	/** Whether the feature itself starts at `start`, and ends at `end`, not the span cutting it. */
	readonly starts: boolean;
	readonly ends: boolean;
	/** Whether the span cuts its segment or gap at `start`, and at `end`. */
	readonly cutStart: boolean;
	readonly cutEnd: boolean;
}

/**
 * What of `segments`, a feature's or a primer site's, lies in the span, in order along it. On a
 * circular record they may lie in the span a turn before or after where they are counted.
 */
export function pieces(
	segments: readonly (Span & { readonly color: string })[],
	{ start, end }: Span,
	bounds: Bounds,
): Piece[] {
	const runs: [number, number, string | null][] = [];
	for (const [i, segment] of segments.entries()) {
		const before = segments[i - 1];
		if (before && segment.start > before.end) {
			runs.push([before.end, segment.start, null]);
		}
		runs.push([segment.start, segment.end, segment.color]);
	}
	const first = segments[0].start;
	const last = segments[segments.length - 1].end;
	const found: Piece[] = [];
	for (const [low, high, color] of runs) {
		for (const shift of turns(bounds)) {
			const from = Math.max(low + shift, start);
			const to = Math.min(high + shift, end);
			if (from >= to) continue;
			found.push({
				start: from,
				end: to,
				color,
				starts: from === first + shift,
				ends: to === last + shift,
				cutStart: from > low + shift,
				cutEnd: to < high + shift,
			});
		}
	}
	return found.sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Where the point `at` lies in the span, counted as the span counts: either end of the span
 * included, but the two ends of a circle opened whole are one point, its end.
 */
export function points(at: number, span: Span, bounds: Bounds): number[] {
	const { start, end } = span;
	const whole = isWhole(span, bounds);
	return turns(bounds)
		.map((shift) => at + shift)
		.filter((p) => start <= p && p <= end && !(whole && p === start));
}

/** How far a position may lie from where the record counts it: a turn either way on a circle. */
export function turns({ length, circular }: Bounds): number[] {
	return circular ? [-length, 0, length] : [0];
}

/** Whether `span` opens a circle whole, so that its two ends are one point. */
export function isWhole(
	{ start, end }: Span,
	{ length, circular }: Bounds,
): boolean {
	return circular && end - start === length;
}

/**
 * The point `at` as a reader reads it, GenBank's `before^after`. At a circle's origin the last
 * base is before the first; a linear record's ends read `0^1` and `length^length+1`.
 */
export function pointText(at: number, { length, circular }: Bounds): string {
	return circular
		? `${((at - 1 + length) % length) + 1}^${(at % length) + 1}`
		: `${at}^${at + 1}`;
}

/** `span` as a reader reads it, 1-based and inclusive, across the origin as `2684 .. 3`. */
export function spanText({ start, end }: Span, length: number): string {
	return `${(start % length) + 1} .. ${((end - 1) % length) + 1}`;
}
