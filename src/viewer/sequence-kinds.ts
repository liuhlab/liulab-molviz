/** The sequence view's primers, cut sites and insertions, each row's lanes and marks of them. */

import { type Arrow, outline, overhang, pack } from "./arrows";
import { cutSites } from "./cuts";
import { folded } from "./format";
import { type Label, labelOf } from "./labels";
import {
	INK,
	INSERTION,
	OUTLINE_WIDTH,
	PRIMER,
	painted,
	shaded,
} from "./paint";
import { pieces, pointText, spanText } from "./pieces";
import type { Bounds } from "./record";
import type { Box, Shape } from "./scene";
import type { Drawn, Lane, Row, Strands } from "./sequence";
import type { Anchored } from "./staircase";

/** How wide a base's cell is, as the rows set it. */
const CELL = 11;

/** The height of a row's top, where every leader from a label above it ends. */
const ROW_TOP = 0;

// A primer's arrow: its band's thickness, and the room between two tracks. Then how far its tail
// bends away from the band's middle, and how thick it is.
const PRIMER_BAND = 4;
const PRIMER_GAP = 2;
const BEND = 6;
const TAIL_WIDTH = 1.5;

// How far a primer's track reaches towards the bases, its head's half, and away from them.
const NEAR = PRIMER_BAND / 2 + overhang(PRIMER_BAND);
const AWAY = Math.max(BEND + TAIL_WIDTH / 2, NEAR);
const TRACK = AWAY + NEAR + PRIMER_GAP;

/** A base a primer does not pair with: its mark's colour, and the room either side in its cell. */
const MISMATCH = "#cc3311";
const MARK_INSET = 2;

/** The outline of a cut site's recognition span, and the thickness of its cuts' lines. */
const BOX = "#7f7f7f";
const CUT_WIDTH = 1.2;

const INSERTION_WIDTH = 2;

const NOTHING: Drawn = { shapes: [], labels: [] };

/** The forward primers' arrows in `row`, in a lane from `top` down, above its numbers. */
export function forwardPrimers(row: Row, top: number): Lane {
	return primers(row, top, 1);
}

/** The reverse primers' arrows in `row`, in a lane from `top` down, under its strands. */
export function reversePrimers(row: Row, top: number): Lane {
	return primers(row, top, -1);
}

/** The cut sites and insertions in `row`, drawn through its `strands`. */
export function acrossStrands(row: Row, strands: Strands): Drawn {
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
 * site and the line of its tail where the row holds them, and where each base of the site it does
 * not pair with starts.
 */
interface Primed {
	readonly start: number;
	readonly end: number;
	readonly label: Label;
	readonly arrow: Arrow | null;
	/** From the end nearer the site; it `bends` where it leaves the site. */
	readonly tail: readonly [near: number, far: number] | null;
	readonly bends: boolean;
	readonly mismatches: readonly number[];
}

/**
 * The primer sites on `strand` in `row`, each an arrow, its 5' tail and its mismatches, in tracks
 * packed by start from `top` down, the first track nearest the bases. Each is labelled above the
 * row where the row holds part of its site.
 */
function primers(row: Row, top: number, strand: 1 | -1): Lane {
	const found = primed(row, strand);
	const tracks = pack(found);
	const count = Math.max(0, ...tracks.map((track) => track + 1));
	const shapes: Shape[] = [];
	for (const [
		i,
		{ label, arrow, tail, bends, mismatches },
	] of found.entries()) {
		const middle =
			strand === 1
				? top + (count - 1 - tracks[i]) * TRACK + AWAY
				: top + tracks[i] * TRACK + PRIMER_GAP + NEAR;
		if (tail) {
			shapes.push(tailShape(tail, bends, middle, -strand, label.color));
		}
		if (arrow) {
			shapes.push({
				shape: "polygon",
				points: outline(arrow, middle, PRIMER_BAND),
				fill: arrow.color,
				stroke: shaded(arrow.color),
				strokeWidth: OUTLINE_WIDTH,
			});
		}
		for (const x of mismatches) {
			shapes.push({
				shape: "rect",
				x: x + MARK_INSET,
				y: middle - NEAR,
				width: CELL - 2 * MARK_INSET,
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
	return { shapes, labels, bottom: top + count * TRACK };
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
			const label = labelOf(
				{ kind: "primers", name, spans: [{ start, end }] },
				[{ text: `${name} (${spanText(site, bounds.length)})`, face: "sans" }],
				PRIMER,
				options.highlight,
			);
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
					tail: tailed ? [at(near), at(far)] : null,
					bends: strand === 1 ? low <= piece.end : piece.start <= high,
					mismatches: (site.mismatches ?? []).flatMap((base) => {
						// A site across the origin holds the bases past it a turn on.
						const position =
							low + ((base - start + bounds.length) % bounds.length);
						return first <= position && position < last ? [at(position)] : [];
					}),
				});
			}
		}
	}
	return found;
}

/**
 * A primer's tail from `near` to `far` about the height `middle`, `away` from the bases (-1 up,
 * 1 down): bent from the middle across its first cell where it `bends`, else level.
 */
function tailShape(
	[near, far]: readonly [number, number],
	bends: boolean,
	middle: number,
	away: number,
	color: string,
): Shape {
	const level = middle + away * BEND;
	const step = Math.sign(far - near) * CELL;
	const points: [number, number][] = !bends
		? [
				[near, level],
				[far, level],
			]
		: Math.abs(far - near) <= CELL
			? [
					[near, middle],
					[far, level],
				]
			: [
					[near, middle],
					[near + step, level],
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
function cuts(row: Row, { top, rail, bottom }: Strands): Drawn {
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
			for (const piece of pieces([{ start, end, color: BOX }], row, bounds)) {
				add({
					shape: "rect",
					x: at(piece.start),
					y: top[0],
					width: at(piece.end) - at(piece.start),
					height: floor - top[0],
					corner: 0,
					fill: "none",
					stroke: painted(BOX, dim),
					strokeWidth: OUTLINE_WIDTH,
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
function insertions(row: Row, { top, rail, bottom }: Strands): Drawn {
	const { record, options, bounds, at } = row;
	if (options.kinds_off.includes("insertions")) return NOTHING;
	const [y1, y2] = [top[0], bottom ? bottom[1] : rail];
	const shapes: Shape[] = [];
	const labels: Anchored[] = [];
	const covers: Box[] = [];
	for (const insertion of record.insertions) {
		const hover = [insertion.name.trim(), pointText(insertion.at, bounds)]
			.filter(Boolean)
			.join(" · ");
		const label = labelOf(
			{ kind: "insertions", name: insertion.name, at: insertion.at },
			[{ text: `+${insertion.length} bp`, face: "sans" }],
			insertion.color?.toLowerCase() ?? INSERTION,
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
	const whole = bounds.circular && span.end - span.start === bounds.length;
	if (p === start && !after && (start > span.start || whole)) return false;
	if (p === end && after && (end < span.end || whole)) return false;
	return true;
}

/** How far a position may lie from where the record counts it: a turn either way on a circle. */
function turns({ length, circular }: Bounds): number[] {
	return circular ? [0, -length, length] : [0];
}
