/**
 * The line: a record, or a span of it, laid out as a scene of shapes and text in points, x to
 * the right and y down, the line running right from (0, 0).
 */

import {
	type Arrow,
	BAND,
	type Bar,
	barShapes,
	barsOf,
	coloredFeatures,
	isUnder,
	OVERHANG,
	outline,
	overhang,
	PRIMER_BAND,
	PRIMER_GAP,
	pack,
	places,
	TIER_GAP,
} from "./arrows";
import { cutSites } from "./cuts";
import {
	GAP,
	hiddenOf,
	KINDS,
	type Kind,
	LABEL_SIZE,
	type Label,
	labelOf,
	type MapScene,
	noticeShapes,
	PAD_Y,
	SMALL_SIZE,
} from "./labels";
import type { Options } from "./options";
import {
	INK,
	INSERTION,
	INSERTION_WIDTH,
	OUTLINE_WIDTH,
	PRIMER,
	shaded,
} from "./paint";
import { pieces, points, pointText, spanText } from "./pieces";
import type { Bounds, Record, Span } from "./record";
import { type Box, leftEdge, type Shape } from "./scene";
import { type Anchored, labelsAbove } from "./staircase";
import {
	baseline,
	type Face,
	height,
	measure,
	metrics,
	textWidth,
} from "./text";

/** The line's length, unless a layout is given another. */
const WIDTH = 720;

/** How far an insertion's bar reaches past the backbone either side. */
const INSERTION_REACH = 1.5;

// The backbone: each strand's line, and how far apart they are.
const BACKBONE = 2.6;
const STRANDS_APART = 3.8;

// The dots at an end: where the first sits beyond the line, how far apart they are, and their size.
const DOT_START = 7;
const DOT_STEP = 6;
const DOT = 1.8;

// The ruler's ticks under the backbone, and how far a number keeps from another and from the
// origin's tick.
const TICK = 6;
const TICK_WIDTH = 1.2;
const ORIGIN_TICK = 12;
const ORIGIN_TICK_WIDTH = 2.4;
const CLEAR = 10;
/** The most numbers the ruler gives along each `WIDTH` points of the line. */
const NUMBERS = 10;

const NAME_SIZE = 13.5;

/** The room left around everything a record's drawing covers. */
export const MARGIN = 16;

/** What every kind is drawn against. */
export interface Along {
	readonly record: Record;
	readonly options: Options;
	readonly bounds: Bounds;
	/** The x of a position counted as the span counts it. */
	readonly at: (position: number) => number;
	/** The backbone's top edge, where a leader from the backbone starts. */
	readonly backboneTop: number;
}

/** What one kind draws on the line. */
export interface LineMarks {
	/** Its marks, in the order they are drawn. */
	readonly shapes: readonly Shape[];
	/** Its labels, to set above the line. */
	readonly labels: readonly Anchored[];
	/** Its labels shown on what they name, which are never counted hidden. */
	readonly named?: readonly Label[];
	/** How high its marks reach, which the labels clear, and how low, which the title clears. */
	readonly top: number;
	readonly bottom: number;
	/** What its marks cover that their shapes' boxes leave out, such as a bar's stroke. */
	readonly covers?: readonly Box[];
}

/** A kind that draws nothing, which reaches no height either way: what each kind starts from. */
const NOTHING: LineMarks = {
	shapes: [],
	labels: [],
	top: Number.POSITIVE_INFINITY,
	bottom: Number.NEGATIVE_INFINITY,
};

/** How the line draws each kind. One switched off is skipped. */
const DRAWS: { readonly [K in Kind]: (along: Along) => LineMarks } = {
	features,
	primers,
	insertions,
	cuts,
};

/** Each kind's place in the order kinds draw and their labels gather, the first lowest at one x. */
const ORDER: { readonly [K in Kind]: number } = {
	features: 0,
	primers: 1,
	insertions: 2,
	cuts: 3,
};

/** Lay out `record` as a line `width` long, drawn as `options` say. */
export function layout(
	record: Record,
	options: Options,
	width = WIDTH,
): MapScene {
	const { span } = options;
	const { start, end } = span;
	const bounds: Bounds = {
		length: record.bases.length,
		circular: record.circular,
	};
	const { length } = bounds;
	const at = (position: number) => ((position - start) * width) / (end - start);
	const backboneTop = -BACKBONE / 2;
	const along: Along = { record, options, bounds, at, backboneTop };
	const off = new Set(options.kinds_off);
	const drawn = [...KINDS]
		.sort((a, b) => ORDER[a] - ORDER[b])
		.filter((kind) => !off.has(kind))
		.map((kind) => DRAWS[kind](along));
	const shapes: Shape[] = [
		...backbone(width),
		...ends(
			record.circular || start > 0,
			record.circular || end < length,
			width,
		),
		...ruler(span, bounds, at, width),
		...drawn.flatMap((one) => one.shapes),
	];
	const top = Math.min(backboneTop, ...drawn.map((one) => one.top));
	const above = labelsAbove(
		drawn.flatMap((one) => one.labels),
		top,
	);
	shapes.push(...above.shapes);
	const named = new Set(drawn.flatMap((one) => one.named ?? []));
	const hidden = above.hidden.filter((label) => !named.has(label));
	const bottom = Math.max(rulerBottom(), ...drawn.map((one) => one.bottom));
	shapes.push(...title(record.name, length, span, bottom + GAP, width));
	const boxes = [...above.boxes, ...drawn.flatMap((one) => one.covers ?? [])];
	const covered = extent(shapes, width, boxes);
	shapes.push(
		...noticeShapes(
			hidden,
			covered.x + covered.width - MARGIN,
			covered.y + covered.height - MARGIN,
		),
	);
	return {
		extent: extent(shapes, width, boxes),
		shapes,
		hidden: hidden.map(hiddenOf),
	};
}

/** Where the ruler's numbers end, under the backbone. */
function rulerBottom(): number {
	return (
		STRANDS_APART + BACKBONE / 2 + TICK + 2 * PAD_Y + height("sans", SMALL_SIZE)
	);
}

/**
 * Each feature as arrows in tiers under the ruler, its name inside them, under them, or boxed
 * above the line.
 */
function features({
	record,
	options,
	bounds,
	at,
	backboneTop,
}: Along): LineMarks {
	const bars: Bar[] = [];
	for (const { feature, label, segments } of coloredFeatures(record, options)) {
		const found = pieces(segments, options.span, bounds);
		bars.push(
			...barsOf(feature, label, found, at).filter((bar) => bar.arrows.length),
		);
	}
	const tiers = pack(bars);
	const placed = places(bars, tiers);
	const named = new Set(tiers.filter((_, i) => isUnder(placed[i])));
	const lineHeight = height("sans", LABEL_SIZE);
	let y = rulerBottom();
	const middles: number[] = [];
	for (let tier = 0; tier <= Math.max(-1, ...tiers); tier++) {
		y += TIER_GAP;
		middles.push(y + OVERHANG + BAND / 2);
		y += 2 * OVERHANG + BAND;
		if (named.has(tier)) y += PAD_Y + lineHeight;
	}
	const shapes = bars.flatMap((bar, i) =>
		barShapes(bar, middles[tiers[i]], placed[i], false),
	);
	const labels = bars.flatMap((bar, i) =>
		placed[i] === "boxed"
			? [{ label: bar.label, x: (bar.start + bar.end) / 2, foot: backboneTop }]
			: [],
	);
	const inPlace = bars.flatMap((bar, i) =>
		placed[i] && placed[i] !== "boxed" ? [bar.label] : [],
	);
	return { ...NOTHING, shapes, labels, named: inPlace, bottom: y };
}

/** Each cut site in the span, its label on a leader from the backbone's top at the cut. */
function cuts({ record, options, bounds, at, backboneTop }: Along): LineMarks {
	const sites = cutSites(record, options.enzymes, options.highlight);
	const labels = sites.flatMap((site) =>
		points(site.at, options.span, bounds).map((point) => ({
			label: site.label,
			x: at(point),
			foot: backboneTop,
		})),
	);
	return { ...NOTHING, labels };
}

/**
 * Each primer site as a thin arrow above the backbone, its head at the 3' end, in rows packed
 * by start, labelled by the primer's name and the bases the site spans.
 */
function primers({ record, options, bounds, at }: Along): LineMarks {
	const reach = overhang(PRIMER_BAND);
	const step = PRIMER_BAND + 2 * reach + PRIMER_GAP;
	const first = -BACKBONE / 2 - PRIMER_GAP - reach - PRIMER_BAND / 2;
	const drawn: { arrow: Arrow; label: Label }[] = [];
	for (const { name, sites } of record.primers) {
		for (const site of sites) {
			const { start, end } = site;
			const label = labelOf(
				{ kind: "primers", name, spans: [{ start, end }] },
				[{ text: `${name} (${spanText(site, bounds.length)})`, face: "sans" }],
				PRIMER,
				options.highlight,
			);
			const { color } = label;
			const colored = [{ start, end, color }];
			for (const piece of pieces(colored, options.span, bounds)) {
				const arrow: Arrow = {
					start: at(piece.start),
					end: at(piece.end),
					color,
					headStart: piece.starts && site.strand === -1,
					headEnd: piece.ends && site.strand === 1,
					cutStart: piece.cutStart,
					cutEnd: piece.cutEnd,
				};
				drawn.push({ arrow, label });
			}
		}
	}
	const middles = pack(drawn.map(({ arrow }) => arrow)).map(
		(row) => first - row * step,
	);
	const tops = middles.map((middle) => middle - PRIMER_BAND / 2 - reach);
	const shapes: Shape[] = drawn.map(({ arrow }, i) => ({
		shape: "polygon",
		points: outline(arrow, middles[i], PRIMER_BAND),
		fill: arrow.color,
		stroke: shaded(arrow.color),
		strokeWidth: OUTLINE_WIDTH,
	}));
	const labels = drawn.map(({ arrow, label }, i) => ({
		label,
		x: (arrow.start + arrow.end) / 2,
		foot: tops[i],
	}));
	return { ...NOTHING, shapes, labels, top: Math.min(...tops) };
}

/**
 * Each insertion as a bar across both strands at its point, labelled with what it adds, its
 * name and point on hover.
 */
function insertions({
	record,
	options,
	bounds,
	at,
	backboneTop,
}: Along): LineMarks {
	const shapes: Shape[] = [];
	const labels: Anchored[] = [];
	const covers: Box[] = [];
	const [y1, y2] = [
		backboneTop - INSERTION_REACH,
		STRANDS_APART + BACKBONE / 2 + INSERTION_REACH,
	];
	for (const insertion of record.insertions) {
		const point = insertion.at;
		const hover = [insertion.name.trim(), pointText(point, bounds)]
			.filter(Boolean)
			.join(" · ");
		const label = labelOf(
			{ kind: "insertions", name: insertion.name, at: point },
			[{ text: `+${insertion.length} bp`, face: "sans" }],
			insertion.color?.toLowerCase() ?? INSERTION,
			options.highlight,
		);
		const { color } = label;
		for (const x of points(point, options.span, bounds).map(at)) {
			shapes.push({
				shape: "line",
				x1: x,
				y1,
				x2: x,
				y2,
				stroke: color,
				strokeWidth: INSERTION_WIDTH,
				hover,
			});
			covers.push({
				x: x - INSERTION_WIDTH / 2,
				y: y1,
				width: INSERTION_WIDTH,
				height: y2 - y1,
			});
			labels.push({ label, x, foot: backboneTop });
		}
	}
	return { ...NOTHING, shapes, labels, covers };
}

/** The box each shape takes, but a line, which takes none. */
export function boxOf(shape: Shape): Box | null {
	switch (shape.shape) {
		case "line":
			return null;
		case "rect":
			return shape;
		case "polygon":
			return around(shape.points);
		case "path":
			return around(
				shape.commands.flatMap((command) => {
					if (command[0] === "Z") return [];
					// An arc's box is its ends', its bulge left out.
					if (command[0] === "A") return [[command[4], command[5]] as const];
					return [[command[1], command[2]] as const];
				}),
			);
		case "circle":
			return {
				x: shape.cx - shape.r,
				y: shape.cy - shape.r,
				width: 2 * shape.r,
				height: 2 * shape.r,
			};
		case "text": {
			const width = textWidth(shape.text, shape.face, shape.size, shape.cell);
			return {
				x: leftEdge(shape, width),
				y: shape.y - metrics(shape.face).ascent * shape.size,
				width,
				height: height(shape.face, shape.size),
			};
		}
	}
}

/** The box around `points`, or nothing for none. */
export function around(
	points: readonly (readonly [x: number, y: number])[],
): Box | null {
	if (!points.length) return null;
	const xs = points.map(([x]) => x);
	const ys = points.map(([, y]) => y);
	const x = Math.min(...xs);
	const y = Math.min(...ys);
	return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** What `shapes`, a backbone `width` long and the boxes `more` cover, and `MARGIN` beyond. */
function extent(
	shapes: readonly Shape[],
	width: number,
	more: readonly Box[],
): Box {
	const boxes = [
		{ x: 0, y: -BACKBONE / 2, width, height: STRANDS_APART + BACKBONE },
		...shapes.flatMap((shape) => boxOf(shape) ?? []),
		...more,
	];
	const left = Math.min(...boxes.map((b) => b.x)) - MARGIN;
	const top = Math.min(...boxes.map((b) => b.y)) - MARGIN;
	const right = Math.max(...boxes.map((b) => b.x + b.width)) + MARGIN;
	const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + MARGIN;
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * The ticks and numbers under the backbone. A tick marks the end of each base whose number is a
 * multiple of the step, and a longer one the origin, where the span runs across it.
 */
function ruler(
	{ start, end }: Span,
	{ length, circular }: Bounds,
	at: (position: number) => number,
	width: number,
): Shape[] {
	const below = STRANDS_APART + BACKBONE / 2;
	const middle = below + TICK + PAD_Y + height("sans", SMALL_SIZE) / 2;
	const origin = circular && start < length && length < end ? at(length) : null;
	const shapes: Shape[] = [];
	const tick = (x: number, long: number, width: number) =>
		shapes.push({
			shape: "line",
			x1: x,
			y1: below,
			x2: x,
			y2: below + long,
			stroke: INK,
			strokeWidth: width,
		});
	if (origin !== null) tick(origin, ORIGIN_TICK, ORIGIN_TICK_WIDTH);
	const step = tickStep(end - start, width);
	let right = Number.NEGATIVE_INFINITY;
	for (const offset of circular ? [0, length] : [0]) {
		const first =
			Math.floor((Math.max(start, offset) - offset) / step) * step + step;
		const last = Math.min(end, offset + length);
		for (let position = offset + first; position <= last; position += step) {
			const x = at(position);
			tick(x, TICK, TICK_WIDTH);
			const text = String(position - offset);
			const half = measure(text, "sans", SMALL_SIZE) / 2;
			if (x - half < right + CLEAR) continue;
			if (origin !== null && Math.abs(x - origin) < half + CLEAR) continue;
			shapes.push({
				shape: "text",
				text,
				face: "sans",
				size: SMALL_SIZE,
				x,
				y: baseline("sans", SMALL_SIZE, middle),
				anchor: "middle",
				fill: INK,
			});
			right = x + half;
		}
	}
	return shapes;
}

/**
 * The least of 1, 2 or 5 times a power of ten that gives at most `NUMBERS` numbers along each
 * `WIDTH` points of a line `width` long drawing `bases`.
 */
function tickStep(bases: number, width: number): number {
	for (let power = 1; ; power *= 10) {
		for (const factor of [1, 2, 5]) {
			if (factor * power * NUMBERS * width >= bases * WIDTH) {
				return factor * power;
			}
		}
	}
}

/**
 * The record's name in bold over its length, or over the span drawn, from the height `top`,
 * centred on a line `width` long.
 */
function title(
	name: string,
	length: number,
	span: Span,
	top: number,
	width: number,
): Shape[] {
	const bases = span.end - span.start;
	const whole = span.start === 0 && span.end === length;
	const lines: [string, Face, number][] = [
		...(name.trim()
			? [[name, "sans-bold", NAME_SIZE] as [string, Face, number]]
			: []),
		[
			whole ? `${length} bp` : `${spanText(span, length)} (${bases} bp)`,
			"sans",
			SMALL_SIZE,
		],
	];
	const shapes: Shape[] = [];
	let y = top;
	for (const [text, face, size] of lines) {
		const h = height(face, size);
		shapes.push({
			shape: "text",
			text,
			face,
			size,
			x: width / 2,
			y: baseline(face, size, y + h / 2),
			anchor: "middle",
			fill: INK,
		});
		y += h;
	}
	return shapes;
}

function backbone(width: number): Shape[] {
	return [0, STRANDS_APART].map((y) => ({
		shape: "line",
		x1: 0,
		y1: y,
		x2: width,
		y2: y,
		stroke: INK,
		strokeWidth: BACKBONE,
	}));
}

/** `• • •` beyond each end of a line `width` long that the molecule carries on past. */
function ends(left: boolean, right: boolean, width: number): Shape[] {
	const offsets = [0, 1, 2].map((i) => DOT_START + i * DOT_STEP);
	const xs = [
		...(left ? offsets.map((offset) => -offset) : []),
		...(right ? offsets.map((offset) => width + offset) : []),
	];
	return xs.map((cx) => ({
		shape: "circle",
		cx,
		cy: STRANDS_APART / 2,
		r: DOT,
		fill: INK,
	}));
}
