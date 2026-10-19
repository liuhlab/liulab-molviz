/**
 * The line: a record, or a span of it, laid out as a scene of shapes and text in points, x to
 * the right and y down, the line running right from (0, 0).
 */

import { cutSites } from "./cuts";
import {
	GAP,
	hiddenOf,
	type Kind,
	LABEL_SIZE,
	type Label,
	type MapScene,
	noticeShapes,
	PAD_X,
	PAD_Y,
	SMALL_SIZE,
} from "./labels";
import type { Options } from "./options";
import {
	CONNECTOR,
	colorOf,
	INK,
	INSERTION,
	OUTLINE_WIDTH,
	PRIMER,
	painted,
	shaded,
	textColor,
	unlit,
} from "./paint";
import type { Bounds, Record, Span } from "./record";
import { type Box, leftEdge, type Shape } from "./scene";
import { type Anchored, labelsAbove } from "./staircase";
import { baseline, type Face, height, measure, metrics } from "./text";

/** The line's length, unless a layout is given another. */
const WIDTH = 720;

// A feature's arrow: the band's thickness, how far a head reaches beyond the band, the least room
// between two bars in a tier, and between tiers.
const BAND = 15;
const OVERHANG = 4;
const HEAD = 12;
const BAR_GAP = 3;
const TIER_GAP = 4;

// A primer's arrow above the backbone: its band's thickness, and the room either side of it.
const PRIMER_BAND = 4;
const PRIMER_GAP = 2;

// An insertion's bar: how far it reaches past the backbone either side, and how thick it is.
const INSERTION_REACH = 1.5;
const INSERTION_WIDTH = 2;

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

const CONNECTOR_WIDTH = 1.5;

/** The room left around everything the drawing covers. */
const MARGIN = 16;

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
export interface Drawn {
	/** Its marks, in the order they are drawn. */
	readonly shapes: readonly Shape[];
	/** Its labels, to set above the line. */
	readonly labels: readonly Anchored[];
	/** How high its marks reach, which the labels clear, and how low, which the title clears. */
	readonly top: number;
	readonly bottom: number;
	/** What its marks cover that their shapes' boxes leave out, such as a bar's stroke. */
	readonly covers?: readonly Box[];
}

const NOTHING: Drawn = {
	shapes: [],
	labels: [],
	top: Number.POSITIVE_INFINITY,
	bottom: Number.NEGATIVE_INFINITY,
};

/** How the line draws each kind. One switched off is skipped. */
const DRAWS: { readonly [K in Kind]: (along: Along) => Drawn } = {
	features,
	primers,
	insertions,
	cuts,
};

/** The order kinds draw in and their labels gather in, where the first sits lowest at one x. */
const ORDER: readonly Kind[] = ["features", "primers", "insertions", "cuts"];

/** What of a feature lies in the span: part of a segment, or of a gap between two. */
interface Piece {
	/** Where it lies, counted as the span counts. */
	readonly start: number;
	readonly end: number;
	/** The colour of its segment, or `null` for part of a gap. */
	readonly color: string | null;
	/** Whether the feature itself starts at `start`, and ends at `end`, not the span cutting it. */
	readonly starts: boolean;
	readonly ends: boolean;
}

/** One segment's arrow along the line. */
interface Arrow {
	readonly start: number;
	readonly end: number;
	readonly color: string;
	readonly headStart: boolean;
	readonly headEnd: boolean;
}

/** Pieces of a feature that follow on from one another, drawn as one bar in one tier. */
interface Bar {
	readonly start: number;
	readonly end: number;
	readonly arrows: readonly Arrow[];
	readonly gaps: readonly (readonly [number, number])[];
	/** The feature's name, which every bar of the feature shares. */
	readonly label: Label;
}

/**
 * Where a bar's name goes: inside one of its arrows, under it from `under`, in a box, or
 * nowhere when it has none.
 */
type Place = { inside: Arrow } | { under: number } | "boxed" | null;

type Feature = Record["features"][number];

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
	const drawn = ORDER.filter((kind) => !off.has(kind)).map((kind) =>
		DRAWS[kind](along),
	);
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
	const bottom = Math.max(ruled(), ...drawn.map((one) => one.bottom));
	shapes.push(...title(record.name, length, span, bottom + GAP, width));
	const boxes = [...above.boxes, ...drawn.flatMap((one) => one.covers ?? [])];
	const covered = extent(shapes, width, boxes);
	shapes.push(
		...noticeShapes(
			above.hidden,
			covered.x + covered.width - MARGIN,
			covered.y + covered.height - MARGIN,
		),
	);
	return {
		extent: extent(shapes, width, boxes),
		shapes,
		hidden: above.hidden.map(hiddenOf),
	};
}

/** Where the ruler's numbers end, under the backbone. */
function ruled(): number {
	return (
		STRANDS_APART + BACKBONE / 2 + TICK + 2 * PAD_Y + height("sans", SMALL_SIZE)
	);
}

/**
 * Each feature as arrows in tiers under the ruler, its name inside them, under them, or boxed
 * above the line.
 */
function features({ record, options, bounds, at, backboneTop }: Along): Drawn {
	const off = new Set(options.types_off);
	const bars: Bar[] = [];
	for (const feature of record.features) {
		if (off.has(feature.type)) continue;
		const dim = unlit(options.highlight, [feature.name]);
		const colored = feature.segments.map((segment) => ({
			...segment,
			color: painted(colorOf(feature, segment), dim),
		}));
		const found = pieces(colored, options.span, bounds);
		bars.push(...barsOf(feature, dim, found, at));
	}
	const tiers = pack(bars);
	const placed = places(bars, tiers);
	const named = new Set(tiers.filter((_, i) => isUnder(placed[i])));
	const lineHeight = height("sans", LABEL_SIZE);
	let y = ruled();
	const middles: number[] = [];
	for (let tier = 0; tier <= Math.max(-1, ...tiers); tier++) {
		y += TIER_GAP;
		middles.push(y + OVERHANG + BAND / 2);
		y += 2 * OVERHANG + BAND;
		if (named.has(tier)) y += PAD_Y + lineHeight;
	}
	const shapes: Shape[] = [];
	for (const [i, bar] of bars.entries()) {
		const middle = middles[tiers[i]];
		const { dim } = bar.label;
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
				points: outline(arrow, middle),
				fill: arrow.color,
				stroke: shaded(arrow.color),
				strokeWidth: OUTLINE_WIDTH,
			});
		}
		const place = placed[i];
		if (place === "boxed" || place === null) continue;
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
	const labels = bars.flatMap((bar, i) =>
		placed[i] === "boxed"
			? [{ label: bar.label, x: (bar.start + bar.end) / 2, foot: backboneTop }]
			: [],
	);
	return { shapes, labels, top: Number.POSITIVE_INFINITY, bottom: y };
}

/** Each cut site in the span, its label on a leader from the backbone's top at the cut. */
function cuts({ record, options, bounds, at, backboneTop }: Along): Drawn {
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
function primers({ record, options, bounds, at }: Along): Drawn {
	const reach = overhang(PRIMER_BAND);
	const step = PRIMER_BAND + 2 * reach + PRIMER_GAP;
	const first = -BACKBONE / 2 - PRIMER_GAP - reach - PRIMER_BAND / 2;
	const drawn: { arrow: Arrow; label: Label }[] = [];
	for (const { name, sites } of record.primers) {
		const dim = unlit(options.highlight, [name]);
		const color = painted(PRIMER, dim);
		for (const site of sites) {
			const { start, end } = site;
			const label: Label = {
				kind: "primers",
				name,
				spans: [{ start, end }],
				runs: [
					{ text: `${name} (${spanText(site, bounds.length)})`, face: "sans" },
				],
				color,
				dim,
				cuts: 0,
			};
			const colored = [{ start, end, color }];
			for (const piece of pieces(colored, options.span, bounds)) {
				const arrow: Arrow = {
					start: at(piece.start),
					end: at(piece.end),
					color,
					headStart: piece.starts && site.strand === -1,
					headEnd: piece.ends && site.strand === 1,
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
	return {
		shapes,
		labels,
		top: Math.min(...tops),
		bottom: Number.NEGATIVE_INFINITY,
	};
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
}: Along): Drawn {
	const shapes: Shape[] = [];
	const labels: Anchored[] = [];
	const covers: Box[] = [];
	const [y1, y2] = [
		backboneTop - INSERTION_REACH,
		STRANDS_APART + BACKBONE / 2 + INSERTION_REACH,
	];
	for (const insertion of record.insertions) {
		const point = insertion.at;
		const dim = unlit(options.highlight, [insertion.name]);
		const color = painted(insertion.color?.toLowerCase() ?? INSERTION, dim);
		const hover = [insertion.name.trim(), pointText(point, bounds)]
			.filter(Boolean)
			.join(" · ");
		const label: Label = {
			kind: "insertions",
			name: insertion.name,
			spans: [{ start: point, end: point }],
			runs: [{ text: `+${insertion.length} bp`, face: "sans" }],
			color,
			dim,
			cuts: 0,
		};
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
	return {
		shapes,
		labels,
		top: Number.POSITIVE_INFINITY,
		bottom: Number.NEGATIVE_INFINITY,
		covers,
	};
}

/**
 * Where the point `at` lies in the span, counted as the span counts: either end of the span
 * included, but the two ends of a circle opened whole are one point, its end.
 */
function points(
	at: number,
	{ start, end }: Span,
	{ length, circular }: Bounds,
): number[] {
	const whole = circular && end - start === length;
	return (circular ? [-length, 0, length] : [0])
		.map((shift) => at + shift)
		.filter((p) => start <= p && p <= end && !(whole && p === start));
}

/**
 * The point `at` as a reader reads it, GenBank's `before^after`. At a circle's origin the last
 * base is before the first; a linear record's ends read `0^1` and `length^length+1`.
 */
function pointText(at: number, { length, circular }: Bounds): string {
	return circular
		? `${((at - 1 + length) % length) + 1}^${(at % length) + 1}`
		: `${at}^${at + 1}`;
}

/** `span` as a reader reads it, 1-based and inclusive, across the origin as `2684 .. 3`. */
function spanText({ start, end }: Span, length: number): string {
	return `${(start % length) + 1} .. ${((end - 1) % length) + 1}`;
}

function isUnder(place: Place): place is { under: number } {
	return typeof place === "object" && place !== null && "under" in place;
}

/** An arrow's band less its heads, as where it starts and ends. */
function body(arrow: Arrow): [number, number] {
	const heads = Number(arrow.headStart) + Number(arrow.headEnd);
	const head = heads ? Math.min(HEAD, (arrow.end - arrow.start) / heads) : 0;
	return [
		arrow.headStart ? arrow.start + head : arrow.start,
		arrow.headEnd ? arrow.end - head : arrow.end,
	];
}

function middleOf([first, last]: [number, number]): number {
	return (first + last) / 2;
}

function room(arrow: Arrow): number {
	const [first, last] = body(arrow);
	return last - first;
}

/**
 * Where each bar's name goes. Inside the arrow with most room, when it fits there. Otherwise
 * under the bar, centred, when it meets no other bar in its tier and no name already set under
 * one there. Otherwise in a box.
 */
function places(bars: readonly Bar[], tiers: readonly number[]): Place[] {
	const placed: Place[] = bars.map(() => "boxed");
	const lineHeight = height("sans", LABEL_SIZE);
	const members = new Map<number, number[]>();
	for (const [i, tier] of tiers.entries()) {
		members.set(tier, [...(members.get(tier) ?? []), i]);
	}
	for (const tier of [...members.keys()].sort((a, b) => a - b)) {
		const inTier = (members.get(tier) ?? []).sort(
			(i, j) => bars[i].start - bars[j].start,
		);
		let last = Number.NEGATIVE_INFINITY;
		for (const i of inTier) {
			const bar = bars[i];
			const { name } = bar.label;
			if (!name.trim()) {
				placed[i] = null;
				continue;
			}
			const width = measure(name, "sans", LABEL_SIZE);
			const roomiest = bar.arrows.reduce((a, b) => (room(b) > room(a) ? b : a));
			if (width + 2 * PAD_X <= room(roomiest) && lineHeight <= BAND) {
				placed[i] = { inside: roomiest };
				continue;
			}
			const left = (bar.start + bar.end - width) / 2;
			const near = inTier.some(
				(j) =>
					j !== i &&
					bars[j].end > left - BAR_GAP &&
					bars[j].start < left + width + BAR_GAP,
			);
			if (left < last + BAR_GAP || near) continue;
			placed[i] = { under: left };
			last = left + width;
		}
	}
	return placed;
}

/** The box each shape takes, a line's stroke left out. */
function bounds(shape: Shape): Box | null {
	switch (shape.shape) {
		case "line":
			return null;
		case "rect":
			return shape;
		case "polygon": {
			const xs = shape.points.map(([x]) => x);
			const ys = shape.points.map(([, y]) => y);
			const x = Math.min(...xs);
			const y = Math.min(...ys);
			return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
		}
		case "circle":
			return {
				x: shape.cx - shape.r,
				y: shape.cy - shape.r,
				width: 2 * shape.r,
				height: 2 * shape.r,
			};
		case "text": {
			const width = measure(shape.text, shape.face, shape.size);
			return {
				x: leftEdge(shape, width),
				y: shape.y - metrics(shape.face).ascent * shape.size,
				width,
				height: height(shape.face, shape.size),
			};
		}
	}
}

/** What `shapes`, a backbone `width` long and the boxes `more` cover, and `MARGIN` beyond. */
function extent(
	shapes: readonly Shape[],
	width: number,
	more: readonly Box[],
): Box {
	const boxes = [
		{ x: 0, y: -BACKBONE / 2, width, height: STRANDS_APART + BACKBONE },
		...shapes.flatMap((shape) => bounds(shape) ?? []),
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

/**
 * What of `segments`, a feature's or a primer site's, lies in the span, in order along it. On a
 * circular record they may lie in the span a turn before or after where they are counted.
 */
function pieces(
	segments: readonly (Span & { readonly color: string })[],
	{ start, end }: Span,
	{ length, circular }: Bounds,
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
		for (const shift of circular ? [-length, 0, length] : [0]) {
			const from = Math.max(low + shift, start);
			const to = Math.min(high + shift, end);
			if (from >= to) continue;
			found.push({
				start: from,
				end: to,
				color,
				starts: from === first + shift,
				ends: to === last + shift,
			});
		}
	}
	return found.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** The bars `found` draws, each run of pieces that follow on from one another, dimmed if `dim`. */
function barsOf(
	feature: Feature,
	dim: boolean,
	found: readonly Piece[],
	at: (position: number) => number,
): Bar[] {
	const label: Label = {
		kind: "features",
		name: feature.name,
		spans: feature.segments.map(({ start, end }) => ({ start, end })),
		runs: [{ text: feature.name, face: "sans" }],
		color: painted(colorOf(feature, feature.segments[0]), dim),
		dim,
		cuts: 0,
	};
	const groups: Piece[][] = [];
	for (const piece of found) {
		const group = groups[groups.length - 1];
		if (group && piece.start === group[group.length - 1].end && !piece.starts) {
			group.push(piece);
		} else {
			groups.push([piece]);
		}
	}
	const bars: Bar[] = [];
	for (const group of groups) {
		const arrows: Arrow[] = [];
		const gaps: [number, number][] = [];
		for (const piece of group) {
			if (piece.color === null) {
				gaps.push([at(piece.start), at(piece.end)]);
				continue;
			}
			arrows.push({
				start: at(piece.start),
				end: at(piece.end),
				color: piece.color,
				headStart:
					piece.starts && (feature.strand === -1 || feature.strand === 2),
				headEnd: piece.ends && (feature.strand === 1 || feature.strand === 2),
			});
		}
		if (arrows.length === 0) continue;
		bars.push({
			start: at(group[0].start),
			end: at(group[group.length - 1].end),
			arrows,
			gaps,
			label,
		});
	}
	return bars;
}

/**
 * The tier of each bar, from 0: the first whose last bar ends `BAR_GAP` or more before it
 * starts, taking bars by earliest start.
 */
function pack(
	bars: readonly { readonly start: number; readonly end: number }[],
): number[] {
	const ends: number[] = [];
	const tiers = new Array<number>(bars.length).fill(0);
	const order = [...bars.keys()].sort(
		(i, j) => bars[i].start - bars[j].start || i - j,
	);
	for (const i of order) {
		let tier = ends.findIndex((last) => last + BAR_GAP <= bars[i].start);
		if (tier < 0) tier = ends.length;
		ends[tier] = bars[i].end;
		tiers[i] = tier;
	}
	return tiers;
}

/**
 * The outline of `arrow` about the height `middle`: its band `band` thick, and a head at each end
 * it has.
 */
function outline(
	arrow: Arrow,
	middle: number,
	band = BAND,
): [number, number][] {
	const [first, last] = body(arrow);
	const reach = overhang(band);
	const top = middle - band / 2;
	const bottom = middle + band / 2;
	const points: [number, number][] = [];
	if (arrow.headStart) {
		points.push([arrow.start, middle], [first, top - reach]);
	}
	points.push([first, top], [last, top]);
	if (arrow.headEnd) {
		points.push(
			[last, top - reach],
			[arrow.end, middle],
			[last, bottom + reach],
		);
	}
	points.push([last, bottom], [first, bottom]);
	if (arrow.headStart) points.push([first, bottom + reach]);
	return points;
}

/** How far the heads of an arrow `band` thick reach beyond it, as a feature's do in proportion. */
function overhang(band: number): number {
	return (band * OVERHANG) / BAND;
}
