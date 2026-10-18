/**
 * The line: a record, or a span of it, laid out as a scene of shapes and text in points, x to
 * the right and y down, the line running right from (0, 0).
 */

import type { Options } from "./options";
import type { Bounds, Record, Span } from "./record";
import { type Box, leftEdge, type Scene, type Shape } from "./scene";
import { baseline, type Face, measure, metrics } from "./text";

/** The line's length. */
const WIDTH = 720;

// A feature's arrow: the band's thickness, how far a head reaches beyond the band, the least room
// between two bars in a tier, and between tiers.
const BAND = 15;
const OVERHANG = 4;
const HEAD = 12;
const BAR_GAP = 3;
const TIER_GAP = 4;

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
/** The most numbers the ruler gives along the line. */
const NUMBERS = 10;

const LABEL_SIZE = 11.5;
const NAME_SIZE = 13.5;
const SMALL_SIZE = 10.5;

// The room around text: either side of it, and above and below it.
const PAD_X = 3;
const PAD_Y = 1;
/** The room between the drawing and the title. */
const GAP = 10;

/** The colour of each group of feature types, by the types it holds. */
// Paul Tol's light scheme, with `#aa3377` from his bright scheme.
// biome-ignore format: a table reads better packed
const GROUPS: readonly [color: string, types: readonly string[]][] = [
	[
		"#77aadd",
		[
			"CDS", "gene", "mat_peptide", "sig_peptide", "transit_peptide", "propeptide",
			"proprotein", "exon", "C_region", "D_segment", "J_segment", "N_region", "S_region",
			"V_region", "V_segment",
		],
	],
	[
		"#ee8866",
		[
			"promoter", "enhancer", "RBS", "-10_signal", "-35_signal", "CAAT_signal",
			"TATA_signal", "GC_signal", "attenuator", "misc_signal", "5'UTR", "regulatory",
		],
	],
	["#ffaabb", ["terminator", "polyA_signal", "polyA_site", "3'UTR"]],
	["#eedd88", ["rep_origin", "oriT"]],
	["#99ddff", ["protein_bind", "misc_binding"]],
	[
		"#44bb99",
		["ncRNA", "misc_RNA", "mRNA", "tRNA", "rRNA", "tmRNA", "precursor_RNA", "prim_transcript"],
	],
	["#bbcc33", ["LTR", "repeat_region", "mobile_element", "misc_recomb", "stem_loop", "D-loop"]],
	["#aa3377", ["primer_bind"]],
];

/** The colour of a type in no group. */
const OTHER = "#dddddd";

const DEFAULTS = new Map(
	GROUPS.flatMap(([color, types]) => types.map((t) => [t, color])),
);

/** How much of each channel of its fill an arrow's outline keeps. */
const OUTLINE_SHADE = 0.45;

// A label in a box above the backbone: the room between boxes, its corners, and its leader.
const SPACING = 2;
const CORNER = 2;
const LEADER = "#7f7f7f";
const LEADER_WIDTH = 0.8;

const INK = "#252525";
const CONNECTOR = "#666666";
const CONNECTOR_WIDTH = 1.5;
const OUTLINE_WIDTH = 0.8;

/** The room left around everything the drawing covers. */
const MARGIN = 16;

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
	/** The feature's name, and the colour its box takes. */
	readonly name: string;
	readonly color: string;
}

/**
 * Where a bar's name goes: inside one of its arrows, under it from `under`, in a box, or
 * nowhere when it has none.
 */
type Place = { inside: Arrow } | { under: number } | "boxed" | null;

type Feature = Record["features"][number];

/** Lay out `record` as a line, drawn as `options` say. */
export function layout(record: Record, options: Options): Scene {
	const { span } = options;
	const { start, end } = span;
	const bounds: Bounds = {
		length: record.bases.length,
		circular: record.circular,
	};
	const { length } = bounds;
	const at = (position: number) => ((position - start) * WIDTH) / (end - start);
	const off = new Set(options.types_off);
	const bars: Bar[] = [];
	for (const feature of record.features) {
		if (off.has(feature.type)) continue;
		const found = pieces(feature, span, bounds);
		bars.push(...barsOf(feature, found, at));
	}
	const tiers = pack(bars);
	const placed = places(bars, tiers);
	const shapes: Shape[] = [
		...backbone(),
		...ends(record.circular || start > 0, record.circular || end < length),
		...ruler(span, bounds, at),
	];
	const named = new Set(tiers.filter((_, i) => isUnder(placed[i])));
	const lineHeight = height("sans", LABEL_SIZE);
	let y =
		STRANDS_APART +
		BACKBONE / 2 +
		TICK +
		2 * PAD_Y +
		height("sans", SMALL_SIZE);
	const middles: number[] = [];
	for (let tier = 0; tier <= Math.max(-1, ...tiers); tier++) {
		y += TIER_GAP;
		middles.push(y + OVERHANG + BAND / 2);
		y += 2 * OVERHANG + BAND;
		if (named.has(tier)) y += PAD_Y + lineHeight;
	}
	for (const [i, bar] of bars.entries()) {
		const middle = middles[tiers[i]];
		for (const [x1, x2] of bar.gaps) {
			shapes.push({
				shape: "line",
				x1,
				y1: middle,
				x2,
				y2: middle,
				stroke: CONNECTOR,
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
		const [x, fill, textMiddle] =
			"inside" in place
				? [middleOf(body(place.inside)), textColor(place.inside.color), middle]
				: [
						place.under + measure(bar.name, "sans", LABEL_SIZE) / 2,
						INK,
						middle + BAND / 2 + OVERHANG + PAD_Y + lineHeight / 2,
					];
		shapes.push({
			shape: "text",
			text: bar.name,
			face: "sans",
			size: LABEL_SIZE,
			x,
			y: baseline("sans", LABEL_SIZE, textMiddle),
			anchor: "middle",
			fill,
		});
	}
	const boxed = bars.filter((_, i) => placed[i] === "boxed");
	shapes.push(...boxes(boxed));
	shapes.push(...title(record.name, length, span, y + GAP));
	return { extent: extent(shapes), shapes };
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
			if (!bar.name.trim()) {
				placed[i] = null;
				continue;
			}
			const width = measure(bar.name, "sans", LABEL_SIZE);
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

/** The boxes above the backbone that name `boxed`, each on a leader down to its bar. */
function boxes(boxed: readonly Bar[]): Shape[] {
	const foot = -BACKBONE / 2;
	const lineHeight = height("sans", LABEL_SIZE);
	const sized = boxed.map((bar) => ({
		width: measure(bar.name, "sans", LABEL_SIZE) + 2 * PAD_X,
		height: lineHeight + 2 * PAD_Y,
		x: (bar.start + bar.end) / 2,
	}));
	const placed = staircase(sized, foot - GAP);
	const shapes: Shape[] = [];
	for (const [i, bar] of boxed.entries()) {
		const at = placed[i];
		shapes.push(
			{
				shape: "line",
				x1: sized[i].x,
				y1: foot,
				x2: sized[i].x,
				y2: at.y + at.height,
				stroke: LEADER,
				strokeWidth: LEADER_WIDTH,
			},
			{
				shape: "rect",
				...at,
				corner: CORNER,
				fill: bar.color,
				stroke: shaded(bar.color),
				strokeWidth: OUTLINE_WIDTH,
			},
			{
				shape: "text",
				text: bar.name,
				face: "sans",
				size: LABEL_SIZE,
				x: at.x + PAD_X,
				y: baseline("sans", LABEL_SIZE, at.y + at.height / 2),
				anchor: "start",
				fill: textColor(bar.color),
			},
		);
	}
	return shapes;
}

/**
 * Place boxes in rows above `base`, each over the point `x` its leader rises from, so close
 * neighbours rise in a staircase and no leader crosses another box.
 *
 * Boxes are placed from the right. A box hangs right from its `x`, just above every box already
 * placed that it meets. It hangs left instead where that puts it lower and it reaches no other
 * `x`, so a box beside a crowd is not lifted over it.
 */
function staircase(
	sized: readonly { width: number; height: number; x: number }[],
	base: number,
): Box[] {
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

/** The height of a line of text in `face` at `size`. */
function height(face: Face, size: number): number {
	const { ascent, descent } = metrics(face);
	return (ascent + descent) * size;
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

/** What `shapes` cover, the backbone's strokes included, and `MARGIN` beyond. */
function extent(shapes: readonly Shape[]): Box {
	const boxes = [
		{ x: 0, y: -BACKBONE / 2, width: WIDTH, height: STRANDS_APART + BACKBONE },
		...shapes.flatMap((shape) => bounds(shape) ?? []),
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
	const step = tickStep(end - start);
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

/** The least of 1, 2 or 5 times a power of ten that gives at most `NUMBERS` numbers. */
function tickStep(bases: number): number {
	for (let power = 1; ; power *= 10) {
		for (const factor of [1, 2, 5]) {
			if (factor * power * NUMBERS >= bases) return factor * power;
		}
	}
}

/** The record's name in bold over its length, or over the span drawn, from the height `top`. */
function title(name: string, length: number, span: Span, top: number): Shape[] {
	const bases = span.end - span.start;
	const whole = span.start === 0 && span.end === length;
	const first = (span.start % length) + 1;
	const last = ((span.end - 1) % length) + 1;
	const lines: [string, Face, number][] = [
		...(name.trim()
			? [[name, "sans-bold", NAME_SIZE] as [string, Face, number]]
			: []),
		[
			whole ? `${length} bp` : `${first} .. ${last} (${bases} bp)`,
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
			x: WIDTH / 2,
			y: baseline(face, size, y + h / 2),
			anchor: "middle",
			fill: INK,
		});
		y += h;
	}
	return shapes;
}

function backbone(): Shape[] {
	return [0, STRANDS_APART].map((y) => ({
		shape: "line",
		x1: 0,
		y1: y,
		x2: WIDTH,
		y2: y,
		stroke: INK,
		strokeWidth: BACKBONE,
	}));
}

/** `• • •` beyond each end of the line the molecule carries on past. */
function ends(left: boolean, right: boolean): Shape[] {
	const offsets = [0, 1, 2].map((i) => DOT_START + i * DOT_STEP);
	const xs = [
		...(left ? offsets.map((offset) => -offset) : []),
		...(right ? offsets.map((offset) => WIDTH + offset) : []),
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
 * What of `feature` lies in the span, in order along it. On a circular record a feature may lie
 * in the span a turn before or after where its segments count it.
 */
function pieces(
	feature: Feature,
	{ start, end }: Span,
	{ length, circular }: Bounds,
): Piece[] {
	const { segments } = feature;
	const runs: [number, number, string | null][] = [];
	for (const [i, segment] of segments.entries()) {
		const before = segments[i - 1];
		if (before && segment.start > before.end) {
			runs.push([before.end, segment.start, null]);
		}
		runs.push([segment.start, segment.end, colorOf(feature, segment)]);
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

/** The bars `found` draws: each run of pieces that follow on from one another. */
function barsOf(
	feature: Feature,
	found: readonly Piece[],
	at: (position: number) => number,
): Bar[] {
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
			name: feature.name,
			color: colorOf(feature, feature.segments[0]),
		});
	}
	return bars;
}

/**
 * The tier of each bar, from 0: the first whose last bar ends `BAR_GAP` or more before it
 * starts, taking bars by earliest start.
 */
function pack(bars: readonly Bar[]): number[] {
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

/** The outline of `arrow` about the height `middle`: its band, and a head at each end it has. */
function outline(arrow: Arrow, middle: number): [number, number][] {
	const [first, last] = body(arrow);
	const top = middle - BAND / 2;
	const bottom = middle + BAND / 2;
	const points: [number, number][] = [];
	if (arrow.headStart) {
		points.push([arrow.start, middle], [first, top - OVERHANG]);
	}
	points.push([first, top], [last, top]);
	if (arrow.headEnd) {
		points.push(
			[last, top - OVERHANG],
			[arrow.end, middle],
			[last, bottom + OVERHANG],
		);
	}
	points.push([last, bottom], [first, bottom]);
	if (arrow.headStart) points.push([first, bottom + OVERHANG]);
	return points;
}

function channels(color: string): [number, number, number] {
	return [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16)) as [
		number,
		number,
		number,
	];
}

/** The colour `segment` of `feature` fills: its own, else the feature's, else its type's. */
function colorOf(
	feature: Feature,
	segment: Feature["segments"][number],
): string {
	const color =
		segment.color ?? feature.color ?? DEFAULTS.get(feature.type) ?? OTHER;
	return color.toLowerCase();
}

/** `color` darkened, so even a white arrow's outline shows on a white ground. */
function shaded(color: string): string {
	return `#${channels(color)
		.map((c) =>
			Math.round(OUTLINE_SHADE * c)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

/** Black or white, whichever contrasts more with `fill` by WCAG 2's ratio, black on a tie. */
function textColor(fill: string): string {
	const [r, g, b] = channels(fill).map((c) => {
		const v = c / 255;
		return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05)
		? "#000000"
		: "#ffffff";
}
