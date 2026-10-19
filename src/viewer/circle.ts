/**
 * The circle: a circular record laid out whole as a ring centred on (0, 0), in points, x to the
 * right and y down. A position's angle runs clockwise from the top.
 */

import { bounds } from "./bounds";
import { type Anchored, columns, REACH } from "./columns";
import {
	hiddenOf,
	hidingOrder,
	LABEL_SIZE,
	type Label,
	labelOf,
	labelShapes,
	labelSize,
	type MapScene,
	noticeShapes,
	PAD_X,
	PAD_Y,
	SMALL_SIZE,
} from "./labels";
import { tickStep, title } from "./line";
import type { Options } from "./options";
import {
	CONNECTOR,
	colorOf,
	INK,
	LEADER,
	OUTLINE_WIDTH,
	painted,
	shaded,
	textColor,
} from "./paint";
import type { Record, Span } from "./record";
import type { Box, PathCommand, Shape } from "./scene";
import { baseline, height, measure } from "./text";

/** The backbone's radius at a zoom of 1. */
const RADIUS = 220;

// The backbone: each strand's line, and how far apart they are.
const BACKBONE = 2.6;
const STRANDS_APART = 3.8;

// The ruler's ticks inside the backbone, and how far a number keeps from the origin's tick.
const TICK = 6;
const TICK_WIDTH = 1.2;
const ORIGIN_TICK = 12;
const ORIGIN_TICK_WIDTH = 2.4;
const CLEAR = 10;

// A ring of features: the band's thickness, how far a head reaches beyond the band and along it,
// the most room from one ring to the next, and the least room between two arrows on one ring.
const BAND = 15;
const OVERHANG = 4;
const HEAD = 12;
const RING_STEP = 25;
const RING_PADDING = 3;
/** How far in the innermost ring's middle may come, as a share of the backbone's radius. */
const CENTRE = 0.4;

const CONNECTOR_WIDTH = 1.5;

/** How far beyond the drawing a label's leader starts. */
const ANCHOR = 4;
const LEADER_WIDTH = 0.8;

/** The room left around everything the drawing covers. */
const MARGIN = 16;

type Feature = Record["features"][number];

/** One segment of a feature, drawn as a band round the centre with a head at either end. */
interface Arrow {
	/** Where it starts and ends, in radians; `end` passes a turn when it runs across the origin. */
	readonly start: number;
	readonly end: number;
	/** The middle of its band, and the band's thickness. */
	readonly radius: number;
	readonly width: number;
	readonly color: string;
	readonly headStart: boolean;
	readonly headEnd: boolean;
	/** The angle each head takes along the band. */
	readonly head: number;
}

/** A feature as the circle draws it: its arrows in order, its name, and where it lies. */
interface Drawn {
	readonly label: Label;
	readonly arrows: readonly Arrow[];
	readonly hull: Span;
	/** Its name set along one of its arrows, if it fits there. */
	readonly name: Shape | null;
}

/** Everything a part of the circle is laid out against. */
interface Ring {
	readonly length: number;
	/** The backbone's radius. */
	readonly radius: number;
	/** The angle of the origin, in radians clockwise from the top. */
	readonly turn: number;
}

/**
 * Lay out `record` as a circle drawn as `options` say, its origin turned `rotation` degrees
 * clockwise from the top, its backbone's radius `zoom` times 220 points.
 */
export function layoutCircle(
	record: Record,
	options: Options,
	rotation = 0,
	zoom = 1,
): MapScene {
	const ring: Ring = {
		length: record.bases.length,
		radius: RADIUS * zoom,
		turn: (rotation * Math.PI) / 180,
	};
	const middle = centre(record.name, ring);
	const drawn = options.kinds_off.includes("features")
		? []
		: features(record, options, ring, middle.reach);
	const drawing = ring.radius + BACKBONE / 2;
	const boxed = drawn.filter(
		(feature) => feature.name === null && feature.label.name.trim(),
	);
	const anchored: Anchored[] = boxed.map(({ label, hull }) => ({
		...labelSize(label),
		anchor: xy(drawing + ANCHOR, angleOf((hull.start + hull.end) / 2, ring)),
	}));
	const order = [...boxed.keys()].sort((i, j) =>
		hidingOrder(boxed[i].label, boxed[j].label),
	);
	const reach = REACH + ring.radius - RADIUS;
	const { placed, hidden } = columns(anchored, order, drawing, reach);
	const shapes: Shape[] = [
		...backbone(ring),
		...ruler(ring),
		...drawn.flatMap(featureShapes),
	];
	const boxes: Box[] = [];
	for (const [i, one] of placed.entries()) {
		if (!one) continue;
		const [from, to] = one.leader;
		shapes.push(
			{
				shape: "line",
				x1: from.x,
				y1: from.y,
				x2: to.x,
				y2: to.y,
				stroke: LEADER,
				strokeWidth: LEADER_WIDTH,
			},
			...labelShapes(boxed[i].label, one.box),
		);
		boxes.push(one.box);
	}
	shapes.push(...middle.shapes);
	const square = drawing + ANCHOR;
	const covered = around(
		[
			{ x: -square, y: -square, width: 2 * square, height: 2 * square },
			...boxes,
		],
		MARGIN,
	);
	const left = hidden.map((i) => boxed[i].label);
	const notice = noticeShapes(
		left,
		covered.x + covered.width - MARGIN,
		covered.y + covered.height - MARGIN,
	);
	shapes.push(...notice);
	const below = notice.flatMap((s) => bounds(s) ?? []);
	return {
		extent: below.length ? around([covered, around(below, MARGIN)]) : covered,
		shapes,
		hidden: left.map(hiddenOf),
	};
}

/** The least box around `boxes`, and `margin` beyond. */
function around(boxes: readonly Box[], margin = 0): Box {
	const left = Math.min(...boxes.map((b) => b.x)) - margin;
	const top = Math.min(...boxes.map((b) => b.y)) - margin;
	const right = Math.max(...boxes.map((b) => b.x + b.width)) + margin;
	const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + margin;
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/** The angle of `position`, in radians clockwise from the top. */
function angleOf(position: number, { length, turn }: Ring): number {
	return (2 * Math.PI * position) / length + turn;
}

/** The point `radius` from the centre at `angle`. */
function pointAt(radius: number, angle: number): [number, number] {
	return [radius * Math.sin(angle), -radius * Math.cos(angle)];
}

function xy(radius: number, angle: number): { x: number; y: number } {
	const [x, y] = pointAt(radius, angle);
	return { x, y };
}

/**
 * An arc on `radius` from `start` to `end`, in pieces of less than a half turn, from the point
 * at `start`, which the path is already at.
 */
function arc(radius: number, start: number, end: number): PathCommand[] {
	if (end === start) return [];
	const pieces = Math.ceil(Math.abs(end - start) / Math.PI + 1e-9);
	const sweep = end > start ? 1 : 0;
	return Array.from({ length: pieces }, (_, i) => {
		const [x, y] = pointAt(radius, start + ((end - start) * (i + 1)) / pieces);
		return ["A", radius, 0, sweep, x, y] as const;
	});
}

/**
 * Each feature's arrows on rings inside the ruler, each ring as far in as the room allows and no
 * nearer the centre than `clear`.
 */
function features(
	record: Record,
	options: Options,
	ring: Ring,
	clear: number,
): Drawn[] {
	const off = new Set(options.types_off);
	const shown = record.features.filter((f) => !off.has(f.type));
	const hulls = shown.map((f) => hullOf(f, ring.length));
	const onRing = rings(hulls, ring);
	const count = Math.max(0, ...onRing) + 1;
	const outer =
		inside(ring) -
		TICK -
		2 * PAD_Y -
		height("sans", SMALL_SIZE) -
		OVERHANG -
		BAND / 2;
	// The innermost band and its heads reach in this many steps past its middle.
	const half = (BAND / 2 + OVERHANG) / RING_STEP;
	// A name wider than the circle's room would leave a step below 0.
	const step = Math.max(
		0,
		Math.min(
			RING_STEP,
			count > 1 ? (outer - CENTRE * ring.radius) / (count - 1) : RING_STEP,
			(outer - clear) / (count - 1 + half),
		),
	);
	const width = (BAND * step) / RING_STEP;
	return shown.map((feature, i) => {
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
		const radius = outer - onRing[i] * step;
		const last = feature.segments.length - 1;
		const { strand } = feature;
		const arrows = feature.segments.map((segment, k): Arrow => {
			const headStart = k === 0 && (strand === -1 || strand === 2);
			const headEnd = k === last && (strand === 1 || strand === 2);
			const heads = Number(headStart) + Number(headEnd);
			const start = angleOf(segment.start, ring);
			const end = angleOf(segment.end, ring);
			return {
				start,
				end,
				radius,
				width,
				color: painted(colorOf(feature, segment), label.dim),
				headStart,
				headEnd,
				head: heads ? Math.min(HEAD / radius, (end - start) / heads) : 0,
			};
		});
		const roomiest = arrows.reduce((a, b) => (room(b) > room(a) ? b : a));
		return {
			label,
			arrows,
			hull: hulls[i],
			name: nameOn(label.name, roomiest),
		};
	});
}

/** The angle an arrow's band runs, less its heads. */
function room(arrow: Arrow): number {
	const heads = Number(arrow.headStart) + Number(arrow.headEnd);
	return arrow.end - arrow.start - arrow.head * heads;
}

/**
 * `name` set along the middle of `arrow`'s band, upright on the lower half, or `null` when it
 * does not fit.
 *
 * Each letter's box is as wide as its advance and as tall as the face, centred on the band's
 * middle and turned square to it. The name fits when it spans, with `PAD_X` at each end, no more
 * of the band's middle than the heads leave, and no letter's corner passes the band's outer edge.
 */
function nameOn(name: string, arrow: Arrow): Shape | null {
	if (!name.trim()) return null;
	const characters = [...name];
	const advances = characters.map((c) => measure(c, "sans", LABEL_SIZE));
	const xs = characters.map(
		(_, i) =>
			measure(characters.slice(0, i + 1).join(""), "sans", LABEL_SIZE) -
			advances[i],
	);
	const last = characters.length - 1;
	const width = xs[last] + advances[last];
	const widest = Math.max(...advances);
	const { radius } = arrow;
	const tall = height("sans", LABEL_SIZE);
	if (
		width + 2 * PAD_X > radius * room(arrow) ||
		Math.hypot(radius + tall / 2, widest / 2) > radius + arrow.width / 2
	) {
		return null;
	}
	const middle =
		arrow.start + (arrow.headStart ? arrow.head : 0) + room(arrow) / 2;
	const upright = Math.cos(middle) >= 0;
	const rise = baseline("sans", LABEL_SIZE, 0);
	const places = characters.map((_, i) => {
		const along = (xs[i] + advances[i] / 2 - width / 2) / radius;
		const angle = upright ? middle + along : middle - along;
		const turn = upright ? angle : angle + Math.PI;
		const [x, y] = pointAt(radius, angle);
		const back = advances[i] / 2;
		return [
			x - back * Math.cos(turn) - rise * Math.sin(turn),
			y - back * Math.sin(turn) + rise * Math.cos(turn),
			normal((turn * 180) / Math.PI),
		] as const;
	});
	return {
		shape: "letters",
		text: name,
		face: "sans",
		size: LABEL_SIZE,
		fill: textColor(arrow.color),
		places,
	};
}

/** Where a feature's first segment starts and its last ends, one turn at most. */
function hullOf({ segments }: Feature, length: number): Span {
	const start = segments[0].start;
	return {
		start,
		end: Math.min(segments[segments.length - 1].end, start + length),
	};
}

/**
 * Each hull's ring, 0 outermost: the first where it overlaps nothing, room for a gap of
 * `RING_PADDING` on the backbone left at each end, taking the longest first.
 */
function rings(hulls: readonly Span[], { length, radius }: Ring): number[] {
	const padding = (length * RING_PADDING) / (2 * Math.PI * radius);
	const order = [...hulls.keys()].sort(
		(i, j) =>
			hulls[j].end - hulls[j].start - (hulls[i].end - hulls[i].start) ||
			hulls[i].start - hulls[j].start,
	);
	const taken: [number, number][][] = [];
	const found: number[] = new Array(hulls.length).fill(0);
	for (const i of order) {
		const start = hulls[i].start - padding;
		const end = hulls[i].end + padding;
		const free = (spans: [number, number][]) =>
			!spans.some(([from, to]) =>
				[-length, 0, length].some(
					(shift) => Math.max(start, from + shift) < Math.min(end, to + shift),
				),
			);
		let at = taken.findIndex(free);
		if (at < 0) at = taken.push([]) - 1;
		taken[at].push([start, end]);
		found[i] = at;
	}
	return found;
}

/** A feature's arrows, each joined to the next by a thin arc across any gap between them. */
function featureShapes({ label, arrows, name }: Drawn): Shape[] {
	const shapes: Shape[] = [];
	for (const [k, after] of arrows.entries()) {
		const before = arrows[k - 1];
		if (!before || after.start <= before.end) continue;
		shapes.push({
			shape: "path",
			commands: [
				["M", ...pointAt(before.radius, before.end)],
				...arc(before.radius, before.end, after.start),
			],
			fill: "none",
			stroke: painted(CONNECTOR, label.dim),
			strokeWidth: CONNECTOR_WIDTH,
		});
	}
	for (const arrow of arrows) {
		shapes.push({
			shape: "path",
			commands: outline(arrow),
			fill: arrow.color,
			stroke: shaded(arrow.color),
			strokeWidth: OUTLINE_WIDTH,
		});
	}
	if (name) shapes.push(name);
	return shapes;
}

/** An arrow's outline: its band, with a head at each end it points to. */
function outline(arrow: Arrow): PathCommand[] {
	const { radius, width, start, end, head } = arrow;
	const reach = (width * OVERHANG) / BAND;
	const first = arrow.headStart ? start + head : start;
	const last = arrow.headEnd ? end - head : end;
	const outer = radius + width / 2;
	const inner = radius - width / 2;
	const to = (r: number, angle: number) => ["L", ...pointAt(r, angle)] as const;
	const commands: PathCommand[] = arrow.headStart
		? [
				["M", ...pointAt(radius, start)],
				to(outer + reach, first),
				to(outer, first),
			]
		: [["M", ...pointAt(outer, first)]];
	commands.push(...arc(outer, first, last));
	if (arrow.headEnd) {
		commands.push(
			to(outer + reach, last),
			to(radius, end),
			to(inner - reach, last),
		);
	}
	commands.push(to(inner, last), ...arc(inner, last, first));
	if (arrow.headStart) commands.push(to(inner - reach, first));
	commands.push(["Z"]);
	return commands;
}

/** Where the backbone's inner strand ends, inside it. */
function inside({ radius }: Ring): number {
	return radius - STRANDS_APART - BACKBONE / 2;
}

/** `degrees` as an angle from -180 up to 180. */
function normal(degrees: number): number {
	return degrees - 360 * Math.floor((degrees + 180) / 360);
}

/**
 * The ticks and numbers inside the backbone, at each multiple of the step. A number reads along
 * its tick, turned to read upright on the lower half, and keeps clear of the origin's tick.
 */
function ruler(ring: Ring): Shape[] {
	const { length } = ring;
	const from = inside(ring);
	const middle = from - TICK - PAD_Y - height("sans", SMALL_SIZE) / 2;
	const rise = baseline("sans", SMALL_SIZE, 0);
	const shapes: Shape[] = [];
	const step = tickStep(length);
	for (let position = step; position < length; position += step) {
		const angle = angleOf(position, ring);
		const [x1, y1] = pointAt(from, angle);
		const [x2, y2] = pointAt(from - TICK, angle);
		shapes.push({
			shape: "line",
			x1,
			y1,
			x2,
			y2,
			stroke: INK,
			strokeWidth: TICK_WIDTH,
		});
		const text = String(position);
		const half = measure(text, "sans", SMALL_SIZE) / 2;
		const fromOrigin =
			(2 * Math.PI * Math.min(position, length - position)) / length;
		if (fromOrigin * middle < half + CLEAR) continue;
		const upright = Math.cos(angle) >= 0;
		const [x, y] = pointAt(upright ? middle - rise : middle + rise, angle);
		shapes.push({
			shape: "text",
			text,
			face: "sans",
			size: SMALL_SIZE,
			x,
			y,
			rotate: normal((angle * 180) / Math.PI - (upright ? 0 : 180)),
			anchor: "middle",
			fill: INK,
		});
	}
	return shapes;
}

/**
 * The record's name in bold over its length, centred on the centre, and how far from the centre
 * their corners reach.
 */
function centre(
	name: string,
	{ length }: Ring,
): { shapes: Shape[]; reach: number } {
	const whole = { start: 0, end: length };
	const lines = title(name, length, whole, 0, 0).filter(
		(s) => s.shape === "text",
	);
	const tall = lines.reduce((sum, t) => sum + height(t.face, t.size), 0);
	const wide = Math.max(...lines.map((t) => measure(t.text, t.face, t.size)));
	return {
		shapes: title(name, length, whole, -tall / 2, 0),
		reach: Math.hypot(wide / 2, tall / 2),
	};
}

/** The two strands, from the origin round, and the origin's tick inside them. */
function backbone(ring: Ring): Shape[] {
	const { radius, turn } = ring;
	const strands: Shape[] = [radius, radius - STRANDS_APART].map((r) => ({
		shape: "path",
		commands: [
			["M", ...pointAt(r, turn)],
			...arc(r, turn, turn + 2 * Math.PI),
			["Z"],
		],
		fill: "none",
		stroke: INK,
		strokeWidth: BACKBONE,
	}));
	const [x1, y1] = pointAt(inside(ring), turn);
	const [x2, y2] = pointAt(inside(ring) - ORIGIN_TICK, turn);
	return [
		...strands,
		{
			shape: "line",
			x1,
			y1,
			x2,
			y2,
			stroke: INK,
			strokeWidth: ORIGIN_TICK_WIDTH,
		},
	];
}
