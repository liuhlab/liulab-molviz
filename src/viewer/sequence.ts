/**
 * The sequence view: a span of a record set in rows of bases, laid out as a scene of shapes and
 * text in points, x to the right and y down, the first row's first base at x = 0.
 */

import {
	barShapes,
	barsOf,
	type ColoredFeature,
	isUnder,
	OVERHANG,
	pack,
	places,
	SHAFT,
	TIER_GAP,
} from "./arrows";
import { aroundBoxes, boxOf } from "./bounds";
import { LABEL_SIZE, type Label, PAD_Y, SMALL_SIZE, tipped } from "./labels";
import { MARGIN } from "./line";
import type { Options } from "./options";
import { INK, RAIL } from "./paint";
import { pieces } from "./pieces";
import { type Bounds, type Record, recordBounds } from "./record";
import {
	type Box,
	moved,
	type PathCommand,
	type Scene,
	type Shape,
} from "./scene";
import { acrossStrands, sites } from "./sequence-kinds";
import { type Sampled, sampledRows, strips } from "./sequence-tracks";
import { chips } from "./sequence-translation";
import { shownBars } from "./shown";
import { type Anchored, labelsAbove } from "./staircase";
import { baseline, height, measure } from "./text";

/** How wide a base's cell is, and the size its letter is set at. */
export const CELL = 11;
const BASE_SIZE = 11;

// The room under the numbers and either side of the rail, how far a tick reaches either side of
// the rail at a base, a fifth and a tenth, and the room before a row's last position.
const NUMBERS_GAP = 2;
const RAIL_GAP = 2;
const TICKS = [1.5, 2.5, 3.5] as const;
const LAST_GAP = 14;

/** The rail's thickness, and its ticks'. */
const RAIL_WIDTH = 1.6;
const TICK_WIDTH = 1;

const ROW_GAP = 16;

/** The sequence view laid out, and its rows, top to bottom. */
export interface SequenceScene extends Scene {
	readonly rows: readonly RowBox[];
}

/** The box a row takes, the bases it holds, counted as the span counts, and its strands. */
export interface RowBox extends Box {
	readonly start: number;
	readonly end: number;
	readonly strands: Strands;
}

/** One row of the view: what it is drawn against, and the bases it holds. */
export interface Row {
	readonly record: Record;
	readonly options: Options;
	readonly bounds: Bounds;
	/** Its bases, counted as the span counts them. */
	readonly start: number;
	readonly end: number;
	/** The x of a point between two bases, counted as the span counts. */
	readonly at: (position: number) => number;
}

/** What a part of a row draws, and the labels it sets above the row. */
export interface RowMarks {
	readonly shapes: readonly Shape[];
	readonly labels: readonly Anchored[];
	/** What its marks cover that their shapes' boxes leave out, such as a line's stroke. */
	readonly covers?: readonly Box[];
}

/** A shelf of a row, stacked under what lies above it: what it draws, and where it ends. */
export interface Shelf extends RowMarks {
	readonly bottom: number;
}

/**
 * The tier each item running on from one row into the next took, by the item: a bar by its
 * label, a primer site or a read by itself.
 */
export type RunOn = Map<object, number>;

/** Where a row's strands lie, each from its top to its bottom, and its rail between them. */
export interface Strands {
	readonly top: readonly [top: number, bottom: number];
	readonly rail: number;
	/** Nothing when the bottom strand is not drawn. */
	readonly bottom: readonly [top: number, bottom: number] | null;
}

/** Lay out the span `options` gives of `record` in rows of `options.bases_per_row` bases. */
export function layoutSequence(
	record: Record,
	options: Options,
): SequenceScene {
	const { span, bases_per_row: perRow } = options;
	const bounds = recordBounds(record);
	const starts: number[] = [];
	for (let start = span.start; start < span.end; start += perRow) {
		starts.push(start);
	}
	const lasts = starts.map((start) =>
		lastText(Math.min(start + perRow, span.end), bounds.length),
	);
	const right =
		perRow * CELL +
		LAST_GAP +
		Math.max(...lasts.map((text) => measure(text, "sans", SMALL_SIZE)));
	const shown = shownBars(record, options);
	const sampled = sampledRows(record, options);
	const shapes: Shape[] = [];
	const rows: RowBox[] = [];
	let before: RunOn = new Map();
	let top = 0;
	for (const [i, start] of starts.entries()) {
		const end = Math.min(start + perRow, span.end);
		const row: Row = {
			record,
			options,
			bounds,
			start,
			end,
			at: (position) => (position - start) * CELL,
		};
		const laid = layoutRow(row, shown, sampled[i], before, lasts[i], right);
		const shift = top - laid.box.y;
		shapes.push(...laid.shapes.map((shape) => moved(shape, 0, shift)));
		const { top: upper, rail, bottom } = laid.strands;
		const down = ([a, b]: readonly [number, number]) =>
			[a + shift, b + shift] as const;
		rows.push({
			...laid.box,
			y: top,
			start,
			end,
			strands: {
				top: down(upper),
				rail: rail + shift,
				bottom: bottom && down(bottom),
			},
		});
		top += laid.box.height + ROW_GAP;
		before = laid.after;
	}
	const covered = aroundBoxes(rows);
	return {
		extent: {
			x: covered.x - MARGIN,
			y: covered.y - MARGIN,
			width: covered.width + 2 * MARGIN,
			height: covered.height + 2 * MARGIN,
		},
		shapes,
		rows,
	};
}

/**
 * One row laid out from the height 0 down, its last position `last` ending at `right`, with the
 * tier each item running on from the row before took there in `before`, the bars of `shown`, and
 * the strips of what `sampled` holds of each track under everything else: its shapes, the box
 * they take, and the tier of each item running on into the row after.
 */
function layoutRow(
	row: Row,
	shown: readonly ColoredFeature[],
	sampled: readonly Sampled[],
	before: RunOn,
	last: string,
	right: number,
): { shapes: Shape[]; box: Box; strands: Strands; after: RunOn } {
	const { record, start, end } = row;
	const forward = sites(row, 0, 1, before);
	let y = forward.bottom;
	const shapes: Shape[] = [...numbers(row, y + height("sans", SMALL_SIZE) / 2)];
	y += height("sans", SMALL_SIZE) + NUMBERS_GAP;
	const bases = basesIn(record.bases, start, end);
	shapes.push(strandText(bases, y));
	const topStrand = [y, y + height("mono", BASE_SIZE)] as const;
	y = topStrand[1] + RAIL_GAP + TICKS[2];
	const rail = y;
	shapes.push(...railShapes(row, rail));
	y += TICKS[2];
	let bottomStrand: readonly [number, number] | null = null;
	if (row.options.bottom_strand) {
		bottomStrand = [y + RAIL_GAP, y + RAIL_GAP + height("mono", BASE_SIZE)];
		shapes.push(strandText(complement(bases), bottomStrand[0]));
		y = bottomStrand[1];
	}
	shapes.push({
		shape: "text",
		text: last,
		face: "sans",
		size: SMALL_SIZE,
		x: right - measure(last, "sans", SMALL_SIZE),
		y: baseline("sans", SMALL_SIZE, rail),
		anchor: "start",
		fill: INK,
	});
	const reverse = sites(row, y, -1, before);
	const barred = bars(row, shown, before, reverse.bottom);
	const strands: Strands = { top: topStrand, rail, bottom: bottomStrand };
	const across = acrossStrands(row, strands);
	const drawn = [
		barred,
		forward,
		reverse,
		across,
		strips(row, sampled, barred.bottom),
	];
	shapes.push(...drawn.flatMap((one) => one.shapes));
	const above = labelsAbove(
		drawn.flatMap((one) => one.labels),
		0,
		{ rise: Number.POSITIVE_INFINITY, tips: true },
	);
	shapes.push(...above.shapes);
	const box = aroundBoxes([
		{ x: 0, y: 0, width: right, height: barred.bottom },
		...shapes.flatMap((shape) => boxOf(shape) ?? []),
		...above.boxes,
		...drawn.flatMap((one) => one.covers ?? []),
	]);
	const after = new Map([...barred.after, ...forward.after, ...reverse.after]);
	return { shapes, box, strands, after };
}

/**
 * The bars in `row` of each of `shown`, a feature or a disagreement over a span, in tiers from
 * the height `top` down, each translated bar under its chips. A bar's name goes inside it, under
 * it, or in a box above the row. Bars starting together keep the order of the tiers they took in
 * the row before, `before`.
 */
function bars(
	row: Row,
	shown: readonly ColoredFeature[],
	before: RunOn,
	top: number,
): Shelf & { after: RunOn } {
	const { start, end, at, bounds, options } = row;
	const found = shown.flatMap(({ feature, label, segments }, order) =>
		barsOf(feature, label, pieces(segments, { start, end }, bounds), at).map(
			(bar) => ({ bar, feature, order }),
		),
	);
	const earlier = (label: Label) =>
		before.get(label) ?? Number.MAX_SAFE_INTEGER;
	found.sort(
		(a, b) =>
			a.bar.start - b.bar.start ||
			earlier(a.bar.label) - earlier(b.bar.label) ||
			a.order - b.order,
	);
	const bars = found.map(({ bar }) => bar);
	const tiers = pack(bars);
	const placed = places(bars, tiers, options.bases_per_row * CELL, true);
	const lineHeight = height("sans", LABEL_SIZE);
	const shapes: Shape[] = [];
	const labels: Anchored[] = [];
	const middles: number[] = [];
	let y = top;
	for (let tier = 0; tier <= Math.max(-1, ...tiers); tier++) {
		y += TIER_GAP;
		let chipped = y;
		for (const [i, { bar, feature }] of found.entries()) {
			if (tiers[i] !== tier) continue;
			const over = chips(feature, bar, row, y);
			shapes.push(...tipped(over.shapes, bar.label));
			labels.push(...over.labels);
			chipped = Math.max(chipped, over.bottom);
		}
		y = chipped;
		middles.push(y + OVERHANG + SHAFT / 2);
		y += 2 * OVERHANG + SHAFT;
		if (tiers.some((t, i) => t === tier && isUnder(placed[i]))) {
			y += PAD_Y + lineHeight;
		}
	}
	const after: RunOn = new Map();
	for (const [i, bar] of bars.entries()) {
		if (bar.end === at(end)) after.set(bar.label, tiers[i]);
		shapes.push(
			...tipped(barShapes(bar, middles[tiers[i]], placed[i], true), bar.label),
		);
		if (placed[i] === "boxed") {
			labels.push({ label: bar.label, x: (bar.start + bar.end) / 2, foot: 0 });
		}
	}
	return { shapes, labels, bottom: y, after };
}

/** The number over each base of `row` the record numbers a multiple of ten, on `middle`. */
function numbers({ start, end, at, bounds }: Row, middle: number): Shape[] {
	const shapes: Shape[] = [];
	for (let position = start; position < end; position++) {
		const n = (position % bounds.length) + 1;
		if (n % 10) continue;
		shapes.push({
			shape: "text",
			text: String(n),
			face: "sans",
			size: SMALL_SIZE,
			x: at(position + 0.5),
			y: baseline("sans", SMALL_SIZE, middle),
			anchor: "middle",
			fill: INK,
		});
	}
	return shapes;
}

/**
 * The rail at the height `rail` along `row`, and its ticks as one path: one at each base, longer
 * where the record numbers it a multiple of five, and longer still at ten.
 */
function railShapes({ start, end, at, bounds }: Row, rail: number): Shape[] {
	const commands: PathCommand[] = [];
	for (let position = start; position < end; position++) {
		const n = (position % bounds.length) + 1;
		const reach = TICKS[Number(n % 5 === 0) + Number(n % 10 === 0)];
		const x = at(position + 0.5);
		commands.push(["M", x, rail - reach], ["L", x, rail + reach]);
	}
	return [
		{
			shape: "line",
			x1: 0,
			y1: rail,
			x2: at(end),
			y2: rail,
			stroke: RAIL,
			strokeWidth: RAIL_WIDTH,
		},
		{
			shape: "path",
			commands,
			fill: "none",
			stroke: RAIL,
			strokeWidth: TICK_WIDTH,
		},
	];
}

/** A strand's letters, one to a cell from x = 0, its top at `top`. */
function strandText(text: string, top: number): Shape {
	return {
		shape: "text",
		text,
		face: "mono",
		size: BASE_SIZE,
		x: 0,
		y: baseline("mono", BASE_SIZE, top + height("mono", BASE_SIZE) / 2),
		anchor: "start",
		fill: INK,
		cell: CELL,
	};
}

/** The bases from `start` to `end` of `bases`, counted on past the origin. */
function basesIn(bases: string, start: number, end: number): string {
	const { length } = bases;
	let out = "";
	for (let at = start; at < end; ) {
		const from = at % length;
		const to = Math.min(length, from + end - at);
		out += bases.slice(from, to);
		at += to - from;
	}
	return out;
}

/** Each base's complement, IUPAC's, in its own case. */
const COMPLEMENTS = new Map(
	[..."ACGTURYSWKMBDHVN"].map((base, i) => [base, "TGCAAYRSWMKVHDBN"[i]]),
);

/** The bases that pair with `bases`, each under its own, in the same case. */
function complement(bases: string): string {
	let out = "";
	for (const base of bases) {
		const upper = base.toUpperCase();
		const paired = COMPLEMENTS.get(upper) ?? base;
		out += base === upper ? paired : paired.toLowerCase();
	}
	return out;
}

/** The number of the base before `end` as a reader reads it. */
function lastText(end: number, length: number): string {
	return String(((end - 1) % length) + 1);
}
