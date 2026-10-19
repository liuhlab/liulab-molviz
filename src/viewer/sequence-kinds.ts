/** The sequence view's primers, cut sites and insertions, each row's shelves and marks of them. */

import {
	type Arrow,
	type Head,
	outline,
	PRIMER_GAP,
	PRIMER_SHAFT,
	pack,
} from "./arrows";
import { cutSites } from "./cuts";
import { folded } from "./format";
import { insertionLabel, type Label, primerLabel } from "./labels";
import {
	CUT_BOX,
	CUT_BOX_WIDTH,
	INK,
	INSERTION_WIDTH,
	MISMATCH,
	OUTLINE_WIDTH,
	painted,
	shaded,
} from "./paint";
import { isWhole, pieces, turns } from "./pieces";
import type { Box, Shape } from "./scene";
import type { Row, RowMarks, RunOn, Shelf, Strands } from "./sequence";
import type { Anchored } from "./staircase";

/** The height of a row's top, where every leader from a label above it ends. */
const ROW_TOP = 0;

/** A primer's head, shorter than the line's so that it fits a cell. */
const HEAD: Head = { length: 6, reach: 2 };

// How far a primer's tail bends away from its shaft's middle, and how thick it is.
const BEND = 6;
const TAIL_WIDTH = 1.5;

// How far a primer's tier reaches towards the bases, its head's half, and away from them; then
// how far one tier lies from the next.
const NEAR = PRIMER_SHAFT / 2 + HEAD.reach;
const AWAY = Math.max(BEND + TAIL_WIDTH / 2, NEAR);
const TIER = AWAY + NEAR + PRIMER_GAP;

/** The room either side of a mismatch's mark in its cell. */
const MARK_INSET = 2;

/** The thickness of a cut's lines. */
const CUT_WIDTH = 1.2;

const NOTHING: RowMarks = { shapes: [], labels: [] };

/** The cut sites and insertions in `row`, drawn through its `strands`. */
export function acrossStrands(row: Row, strands: Strands): RowMarks {
	const cut = cuts(row, strands);
	const inserted = insertions(row, strands);
	return {
		shapes: [...cut.shapes, ...inserted.shapes],
		labels: [...cut.labels, ...inserted.labels],
		covers: inserted.covers,
	};
}

/**
 * What a row holds of one primer site and its tail: where that starts and ends, the arrow of its
 * site and the line of its tail where the row holds them, and the cell of each base of the site it
 * does not pair with.
 */
interface Primed {
	/** The site, as the record gives it. */
	readonly site: object;
	readonly start: number;
	readonly end: number;
	readonly label: Label;
	readonly arrow: Arrow | null;
	/** Its end nearer the site, a cell on from there, and its far end; it `bends` leaving the site. */
	readonly tail: readonly [near: number, next: number, far: number] | null;
	readonly bends: boolean;
	readonly mismatches: readonly (readonly [start: number, end: number])[];
}

/**
 * The primer sites on `strand` in `row`, each an arrow, its 5' tail and its mismatches, in tiers
 * packed by start on a shelf from `top` down, the first tier nearest the bases: the forward
 * primers' above the numbers, the reverse primers' under the strands. Sites starting together
 * keep the order of the tiers they took in the row before, `before`. Each is labelled above the
 * row where the row holds part of its site.
 */
export function primers(
	row: Row,
	top: number,
	strand: 1 | -1,
	before: RunOn,
): Shelf & { after: RunOn } {
	const earlier = (site: object) => before.get(site) ?? Number.MAX_SAFE_INTEGER;
	const found = primed(row, strand).sort(
		(a, b) => a.start - b.start || earlier(a.site) - earlier(b.site),
	);
	const tiers = pack(found);
	const after: RunOn = new Map();
	for (const [i, { site, end }] of found.entries()) {
		if (end === row.at(row.end)) after.set(site, tiers[i]);
	}
	const count = Math.max(0, ...tiers.map((tier) => tier + 1));
	const shapes: Shape[] = [];
	for (const [
		i,
		{ label, arrow, tail, bends, mismatches },
	] of found.entries()) {
		const middle =
			strand === 1
				? top + (count - 1 - tiers[i]) * TIER + AWAY
				: top + tiers[i] * TIER + PRIMER_GAP + NEAR;
		if (tail) {
			shapes.push(tailShape(tail, bends, middle, -strand, label.color));
		}
		if (arrow) {
			shapes.push({
				shape: "polygon",
				points: outline(arrow, middle, PRIMER_SHAFT, false, HEAD),
				fill: arrow.color,
				stroke: shaded(arrow.color),
				strokeWidth: OUTLINE_WIDTH,
			});
		}
		for (const [x, end] of mismatches) {
			shapes.push({
				shape: "rect",
				x: x + MARK_INSET,
				y: middle - NEAR,
				width: end - x - 2 * MARK_INSET,
				height: 2 * NEAR,
				corner: 0,
				fill: painted(MISMATCH, label.dim),
				stroke: "none",
				strokeWidth: 0,
			});
		}
	}
	const labels = found.flatMap(({ label, arrow }) =>
		arrow ? [{ label, x: (arrow.start + arrow.end) / 2, foot: ROW_TOP }] : [],
	);
	return { shapes, labels, bottom: top + count * TIER, after };
}

/** What `row` holds of each primer site on `strand`, with its tail. */
function primed(row: Row, strand: 1 | -1): Primed[] {
	const { record, options, bounds, at } = row;
	if (options.kinds_off.includes("primers")) return [];
	const found: Primed[] = [];
	for (const { name, bases, sites } of record.primers) {
		for (const site of sites) {
			if (site.strand !== strand) continue;
			const { start, end } = site;
			const label = primerLabel(name, site, bounds.length, options.highlight);
			const { color } = label;
			const tail = bases.length - (end - start);
			const whole =
				strand === 1
					? { start: start - tail, end, color }
					: { start, end: end + tail, color };
			for (const piece of pieces([whole], row, bounds)) {
				// The site as it lies in the row: here, or a turn on or back.
				const shift =
					turns(bounds).find(
						(s) => whole.start + s <= piece.start && piece.end <= whole.end + s,
					) ?? 0;
				const [low, high] = [start + shift, end + shift];
				const [first, last] = [
					Math.max(piece.start, low),
					Math.min(piece.end, high),
				];
				const [near, far] =
					strand === 1
						? [Math.min(piece.end, low), piece.start]
						: [Math.max(piece.start, high), piece.end];
				const tailed = strand === 1 ? far < near : near < far;
				found.push({
					site,
					start: at(piece.start),
					end: at(piece.end),
					label,
					arrow:
						first < last
							? {
									start: at(first),
									end: at(last),
									color,
									headStart: strand === -1 && first === low,
									headEnd: strand === 1 && last === high,
									cutStart: first > low,
									cutEnd: last < high,
								}
							: null,
					tail: tailed
						? [at(near), at(near + Math.sign(far - near)), at(far)]
						: null,
					bends: strand === 1 ? low <= piece.end : piece.start <= high,
					mismatches: (site.mismatches ?? []).flatMap((base) => {
						// A site across the origin holds the bases past it a turn on.
						const position =
							low + ((base - start + bounds.length) % bounds.length);
						return first <= position && position < last
							? [[at(position), at(position + 1)] as const]
							: [];
					}),
				});
			}
		}
	}
	return found;
}

/**
 * A primer's tail from `near` to `far` about the height `middle`, `away` from the bases (-1 up,
 * 1 down): bent from the middle across its first cell, to `next`, where it `bends`, else level.
 */
function tailShape(
	[near, next, far]: readonly [number, number, number],
	bends: boolean,
	middle: number,
	away: number,
	color: string,
): Shape {
	const level = middle + away * BEND;
	const points: [number, number][] = !bends
		? [
				[near, level],
				[far, level],
			]
		: Math.abs(far - near) <= Math.abs(next - near)
			? [
					[near, middle],
					[far, level],
				]
			: [
					[near, middle],
					[next, level],
					[far, level],
				];
	return {
		shape: "path",
		commands: points.map(([x, y], i) => [i ? "L" : "M", x, y] as const),
		fill: "none",
		stroke: color,
		strokeWidth: TAIL_WIDTH,
	};
}

/**
 * Each cut site in `row`: a box over each of its cuts' recognition spans, through both strands
 * or the top one, and each cut's lines, through the top strand where it cuts that, along the rail
 * and through the bottom strand where it cuts that, so its overhang shows. A cut is drawn in
 * every row its overhang reaches, and labelled in the row holding its top-strand cut.
 */
function cuts(row: Row, { top, rail, bottom }: Strands): RowMarks {
	const { record, options, bounds, at } = row;
	if (options.kinds_off.includes("cuts")) return NOTHING;
	const on = new Set(options.enzymes.map(folded));
	const floor = bottom ? bottom[1] : rail;
	// Enzymes cutting at one point draw the same lines, and often the same box: each once.
	const shapes = new Map<string, Shape>();
	const add = (shape: Shape) => shapes.set(JSON.stringify(shape), shape);
	const line = (x1: number, y1: number, x2: number, y2: number, dim: boolean) =>
		add({
			shape: "line",
			x1,
			y1,
			x2,
			y2,
			stroke: painted(INK, dim),
			strokeWidth: CUT_WIDTH,
		});
	const labels: Anchored[] = [];
	const sites = cutSites(record, options.enzymes, options.highlight);
	for (const { at: point, label } of sites) {
		const { dim } = label;
		const made = record.cuts.filter(
			(one) => one.at === point && on.has(folded(one.enzyme)),
		);
		for (const { start, end } of made) {
			for (const piece of pieces(
				[{ start, end, color: CUT_BOX }],
				row,
				bounds,
			)) {
				add({
					shape: "rect",
					x: at(piece.start),
					y: top[0],
					width: at(piece.end) - at(piece.start),
					height: floor - top[0],
					corner: 0,
					fill: "none",
					stroke: painted(CUT_BOX, dim),
					strokeWidth: CUT_BOX_WIDTH,
				});
			}
		}
		const staggers = made.map(({ stagger }) => stagger);
		// At the edge between two rows, the row its overhangs lie in, the later one when blunt.
		const after = Math.min(0, ...staggers) + Math.max(0, ...staggers) >= 0;
		for (const shift of turns(bounds)) {
			const p = point + shift;
			const held = holds(row, p, after);
			if (held) {
				line(at(p), top[0], at(p), rail, dim);
				labels.push({ label, x: at(p), foot: ROW_TOP });
			}
			if (!bottom) continue;
			for (const stagger of staggers) {
				const q = p + stagger;
				const [low, high] = [
					Math.max(Math.min(p, q), row.start),
					Math.min(Math.max(p, q), row.end),
				];
				if (!held && low >= high) continue;
				if (low < high) line(at(low), rail, at(high), rail, dim);
				if (row.start <= q && q <= row.end) {
					line(at(q), rail, at(q), bottom[1], dim);
				}
			}
		}
	}
	return { shapes: [...shapes.values()], labels };
}

/**
 * Each insertion in `row` as a line through both strands, or the top one, at its point, in the
 * row holding the base after it. It is labelled with what it adds, its name and point on hover.
 */
function insertions(row: Row, { top, rail, bottom }: Strands): RowMarks {
	const { record, options, bounds, at } = row;
	if (options.kinds_off.includes("insertions")) return NOTHING;
	const [y1, y2] = [top[0], bottom ? bottom[1] : rail];
	const shapes: Shape[] = [];
	const labels: Anchored[] = [];
	const covers: Box[] = [];
	for (const insertion of record.insertions) {
		const { label, hover } = insertionLabel(
			insertion,
			bounds,
			options.highlight,
		);
		for (const shift of turns(bounds)) {
			const p = insertion.at + shift;
			if (!holds(row, p, true)) continue;
			const x = at(p);
			shapes.push({
				shape: "line",
				x1: x,
				y1,
				x2: x,
				y2,
				stroke: label.color,
				strokeWidth: INSERTION_WIDTH,
				hover,
			});
			covers.push({
				x: x - INSERTION_WIDTH / 2,
				y: y1,
				width: INSERTION_WIDTH,
				height: y2 - y1,
			});
			labels.push({ label, x, foot: ROW_TOP });
		}
	}
	return { shapes, labels, covers };
}

/**
 * Whether `row` holds the point `p`, counted as the span counts. At the edge between two rows,
 * or at the two ends of a circle opened whole, the later row holds it if `after`, else the
 * earlier.
 */
function holds(row: Row, p: number, after: boolean): boolean {
	const { start, end, options, bounds } = row;
	const { span } = options;
	if (p < start || p > end) return false;
	const whole = isWhole(span, bounds);
	if (p === start && !after && (start > span.start || whole)) return false;
	if (p === end && after && (end < span.end || whole)) return false;
	return true;
}
