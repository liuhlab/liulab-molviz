/**
 * The sequence view: a span of a record set in rows of bases, laid out as a scene of shapes and
 * text in points, x to the right and y down, the first row's first base at x = 0.
 */

import {
	BAND,
	barsOf,
	body,
	isUnder,
	middleOf,
	OVERHANG,
	outline,
	pack,
	places,
	TIER_GAP,
} from "./arrows";
import { LABEL_SIZE, type Label, labelOf, PAD_Y, SMALL_SIZE } from "./labels";
import { boxOf } from "./line";
import type { Options } from "./options";
import {
	CONNECTOR,
	colorOf,
	INK,
	OUTLINE_WIDTH,
	painted,
	shaded,
	textColor,
} from "./paint";
import { pieces } from "./pieces";
import type { Bounds, Record, Span } from "./record";
import type { Box, PathCommand, Scene, Shape } from "./scene";
import {
	acrossStrands,
	forwardPrimers,
	reversePrimers,
} from "./sequence-kinds";
import { chips } from "./sequence-translation";
import { type Anchored, labelsAbove } from "./staircase";
import { baseline, height, measure } from "./text";

/** The most bases of a span the sequence view draws. */
export const LIMIT = 100_000;

/** How wide a base's cell is, and the size its letter is set at. */
const CELL = 11;
const BASE_SIZE = 11;

// The room under the numbers and either side of the rail, how far a tick reaches either side of
// the rail at a base, a fifth and a tenth, and the room before a row's last position.
const NUMBERS_GAP = 2;
const RAIL_GAP = 2;
const TICKS = [1.5, 2.5, 3.5] as const;
const LAST_GAP = 14;

/** The rail's colour and thickness, and its ticks'. */
const RAIL = "#7f7f7f";
const RAIL_WIDTH = 1.6;
const TICK_WIDTH = 1;

/** The thickness of the line across a join's gap. */
const CONNECTOR_WIDTH = 1.5;

const ROW_GAP = 16;
const MARGIN = 16;

/** The sequence view laid out, and the box each row takes, top to bottom. */
export interface SequenceScene extends Scene {
	readonly rows: readonly Box[];
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
export interface Drawn {
	readonly shapes: readonly Shape[];
	readonly labels: readonly Anchored[];
	/** What its marks cover that their shapes' boxes leave out, such as a line's stroke. */
	readonly covers?: readonly Box[];
}

/** A lane of a row, stacked under what lies above it: what it draws, and where it ends. */
export interface Lane extends Drawn {
	readonly bottom: number;
}

/** Where a row's strands lie, each from its top to its bottom, and its rail between them. */
export interface Strands {
	readonly top: readonly [top: number, bottom: number];
	readonly rail: number;
	/** Nothing when the bottom strand is not drawn. */
	readonly bottom: readonly [top: number, bottom: number] | null;
}

type Feature = Record["features"][number];

/** A feature as each row draws it: its label, and its segments in their colours. */
interface Drawable {
	readonly feature: Feature;
	readonly label: Label;
	readonly segments: readonly (Span & { readonly color: string })[];
}

/** Lay out the span `options` gives of `record` in rows of `options.bases_per_row` bases. */
export function layoutSequence(
	record: Record,
	options: Options,
): SequenceScene {
	const { span, bases_per_row: perRow } = options;
	const bounds: Bounds = {
		length: record.bases.length,
		circular: record.circular,
	};
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
	const drawables = drawable(record, options);
	const shapes: Shape[] = [];
	const rows: Box[] = [];
	let before = new Map<Label, number>();
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
		const laid = layoutRow(row, drawables, before, lasts[i], right);
		const shift = top - laid.box.y;
		shapes.push(...laid.shapes.map((shape) => moved(shape, 0, shift)));
		rows.push({ ...laid.box, y: top });
		top += laid.box.height + ROW_GAP;
		before = laid.after;
	}
	const covered = around(rows);
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

/** The features `options` draws, each with its label and colours. */
function drawable(record: Record, options: Options): Drawable[] {
	if (options.kinds_off.includes("features")) return [];
	const off = new Set(options.types_off);
	return record.features
		.filter((feature) => !off.has(feature.type))
		.map((feature) => {
			const label = labelOf(
				{
					kind: "features",
					name: feature.name,
					spans: feature.segments.map(({ start, end }) => ({ start, end })),
				},
				[{ text: feature.name, face: "sans" }],
				colorOf(feature, feature.segments[0]),
				options.highlight,
			);
			const segments = feature.segments.map((segment) => ({
				...segment,
				color: painted(colorOf(feature, segment), label.dim),
			}));
			return { feature, label, segments };
		});
}

/**
 * One row laid out from the height 0 down, its last position `last` ending at `right`, with the
 * tier each feature running on from the row before took there in `before`: its shapes, the box
 * they take, and the tier of each feature running on into the row after.
 */
function layoutRow(
	row: Row,
	drawables: readonly Drawable[],
	before: ReadonlyMap<Label, number>,
	last: string,
	right: number,
): { shapes: Shape[]; box: Box; after: Map<Label, number> } {
	const { record, start, end } = row;
	const forward = forwardPrimers(row, 0);
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
	const reverse = reversePrimers(row, y);
	const bars = featureBars(row, drawables, before, reverse.bottom);
	const across = acrossStrands(row, {
		top: topStrand,
		rail,
		bottom: bottomStrand,
	});
	const drawn = [bars, forward, reverse, across];
	shapes.push(...drawn.flatMap((one) => one.shapes));
	const above = labelsAbove(
		drawn.flatMap((one) => one.labels),
		0,
		Number.POSITIVE_INFINITY,
	);
	shapes.push(...above.shapes);
	const box = around([
		{ x: 0, y: 0, width: right, height: bars.bottom },
		...shapes.flatMap((shape) => boxOf(shape) ?? []),
		...above.boxes,
		...drawn.flatMap((one) => one.covers ?? []),
	]);
	return { shapes, box, after: bars.after };
}

/**
 * Each feature's bars in `row`, in tiers from the height `top` down, each translated bar under
 * its chips. A bar's name goes inside it, under it, or in a box above the row. Bars starting
 * together keep the order of the tiers they took in the row before, `before`.
 */
function featureBars(
	row: Row,
	drawables: readonly Drawable[],
	before: ReadonlyMap<Label, number>,
	top: number,
): Lane & { after: Map<Label, number> } {
	const { start, end, at, bounds, options } = row;
	const found = drawables.flatMap(({ feature, label, segments }, order) =>
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
	const placed = places(bars, tiers, options.bases_per_row * CELL);
	const lineHeight = height("sans", LABEL_SIZE);
	const shapes: Shape[] = [];
	const labels: Anchored[] = [];
	const middles: number[] = [];
	let y = top;
	for (let tier = 0; tier <= Math.max(-1, ...tiers); tier++) {
		y += TIER_GAP;
		let lane = y;
		for (const [i, { bar, feature }] of found.entries()) {
			if (tiers[i] !== tier) continue;
			const over = chips(feature, bar, row, y);
			shapes.push(...over.shapes);
			labels.push(...over.labels);
			lane = Math.max(lane, over.bottom);
		}
		y = lane;
		middles.push(y + OVERHANG + BAND / 2);
		y += 2 * OVERHANG + BAND;
		if (tiers.some((t, i) => t === tier && isUnder(placed[i]))) {
			y += PAD_Y + lineHeight;
		}
	}
	const after = new Map<Label, number>();
	for (const [i, bar] of bars.entries()) {
		const middle = middles[tiers[i]];
		const { dim } = bar.label;
		if (bar.end === at(end)) after.set(bar.label, tiers[i]);
		for (const [x1, x2] of bar.gaps) {
			shapes.push({
				shape: "line",
				x1,
				y1: middle,
				x2,
				y2: middle,
				stroke: painted(CONNECTOR, dim),
				strokeWidth: CONNECTOR_WIDTH,
			});
		}
		for (const arrow of bar.arrows) {
			shapes.push({
				shape: "polygon",
				points: outline(arrow, middle, BAND, true),
				fill: arrow.color,
				stroke: shaded(arrow.color),
				strokeWidth: OUTLINE_WIDTH,
			});
		}
		const place = placed[i];
		if (place === null) continue;
		if (place === "boxed") {
			labels.push({ label: bar.label, x: (bar.start + bar.end) / 2, foot: 0 });
			continue;
		}
		const { name } = bar.label;
		const [x, fill, textMiddle] =
			"inside" in place
				? [middleOf(body(place.inside)), textColor(place.inside.color), middle]
				: [
						place.under + measure(name, "sans", LABEL_SIZE) / 2,
						painted(INK, dim),
						middle + BAND / 2 + OVERHANG + PAD_Y + lineHeight / 2,
					];
		shapes.push({
			shape: "text",
			text: name,
			face: "sans",
			size: LABEL_SIZE,
			x,
			y: baseline("sans", LABEL_SIZE, textMiddle),
			anchor: "middle",
			fill,
		});
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

/** The box around `boxes`. */
function around(boxes: readonly Box[]): Box {
	const left = Math.min(...boxes.map((b) => b.x));
	const top = Math.min(...boxes.map((b) => b.y));
	const right = Math.max(...boxes.map((b) => b.x + b.width));
	const bottom = Math.max(...boxes.map((b) => b.y + b.height));
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/** `shape` moved `dx` right and `dy` down. */
export function moved(shape: Shape, dx: number, dy: number): Shape {
	switch (shape.shape) {
		case "line":
			return {
				...shape,
				x1: shape.x1 + dx,
				y1: shape.y1 + dy,
				x2: shape.x2 + dx,
				y2: shape.y2 + dy,
			};
		case "polygon":
			return {
				...shape,
				points: shape.points.map(([x, y]) => [x + dx, y + dy] as const),
			};
		case "path":
			return {
				...shape,
				commands: shape.commands.map((command) => {
					switch (command[0]) {
						case "Z":
							return command;
						case "A": {
							const [letter, r, large, sweep, x, y] = command;
							return [letter, r, large, sweep, x + dx, y + dy] as const;
						}
						default: {
							const [letter, x, y] = command;
							return [letter, x + dx, y + dy] as const;
						}
					}
				}),
			};
		case "circle":
			return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
		case "rect":
		case "text":
			return { ...shape, x: shape.x + dx, y: shape.y + dy };
	}
}
