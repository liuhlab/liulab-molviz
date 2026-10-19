/**
 * The circle: a circular record laid out whole as a ring centred on (0, 0), in points, x to the
 * right and y down. A position's angle runs clockwise from the top.
 */

import {
	type ColoredFeature,
	HEAD,
	headsOn,
	OVERHANG,
	overhang,
	PRIMER_GAP,
	PRIMER_SHAFT,
	roomiest,
	SHAFT,
} from "./arrows";
import { aroundBoxes, boxOf } from "./bounds";
import { columns, type Point, REACH, type Unplaced } from "./columns";
import {
	hiddenOf,
	hidingOrder,
	LABEL_SIZE,
	type Label,
	labelShapes,
	labelSize,
	type MapScene,
	noticeShapes,
	PAD_X,
	PAD_Y,
	SMALL_SIZE,
	tipped,
} from "./labels";
import {
	BACKBONE,
	CLEAR,
	INSERTION_REACH,
	MARGIN,
	NAME_SIZE,
	ORIGIN_TICK,
	ORIGIN_TICK_WIDTH,
	STRANDS_APART,
	TICK,
	TICK_WIDTH,
	tickStep,
	titleLines,
	titleShapes,
} from "./line";
import type { Options } from "./options";
import {
	CONNECTOR,
	CONNECTOR_WIDTH,
	INK,
	INSERTION_WIDTH,
	LEADER,
	LEADER_WIDTH,
	OUTLINE_WIDTH,
	painted,
	shaded,
	textColor,
} from "./paint";
import type { Feature, Record, Span } from "./record";
import type { Box, PathCommand, Shape } from "./scene";
import {
	type Aligned,
	type Mark,
	shownBars,
	shownCuts,
	shownMarks,
	shownSites,
} from "./shown";
import { baseline, height, measure, wrap } from "./text";

/** The backbone's radius at a zoom of 1. */
const RADIUS = 220;

// A ring of features: the most room from one ring to the next, and the least room between two
// arrows on one ring.
const RING_STEP = 25;
const RING_PADDING = 3;
/** How far in the innermost ring's middle may come, as a share of the backbone's radius. */
const CENTRE = 0.4;

/** How far beyond the drawing a label's leader starts. */
const ANCHOR = 4;

/** One segment of a feature, drawn as a curved shaft round the centre with a head at either end. */
interface Arrow {
	/** Where it starts and ends, in radians; `end` passes a turn when it runs across the origin. */
	readonly start: number;
	readonly end: number;
	/** The middle of its shaft, and the shaft's thickness. */
	readonly radius: number;
	readonly width: number;
	readonly color: string;
	readonly headStart: boolean;
	readonly headEnd: boolean;
	/** The angle each head takes along the shaft. */
	readonly head: number;
}

/** A feature or a disagreement as the circle draws it: its arrows, its name, and where it lies. */
interface CircleBar {
	readonly label: Label;
	readonly arrows: readonly Arrow[];
	readonly hull: Span;
	/** Its name set along one of its arrows, if it fits there. */
	readonly name: Shape | null;
}

/** A label set in a column, and the angle its leader starts from. */
interface Outside {
	readonly label: Label;
	readonly angle: number;
	/** Whether its leader carries on in to the backbone, to point at a point between two bases. */
	readonly inward: boolean;
}

/** Everything a part of the circle is laid out against. */
interface Circle {
	readonly length: number;
	/** The backbone's radius. */
	readonly radius: number;
	/** The angle of the origin, in radians clockwise from the top. */
	readonly turn: number;
}

/**
 * Lay out `record` as a circle drawn as `options` say, its origin turned `rotation` degrees
 * clockwise from the top, its backbone's radius `zoom` times `RADIUS`.
 */
export function layoutCircle(
	record: Record,
	options: Options,
	rotation = 0,
	zoom = 1,
): MapScene {
	const circle: Circle = {
		length: record.bases.length,
		radius: RADIUS * zoom,
		turn: (rotation * Math.PI) / 180,
	};
	const middle = centre(record.name, circle);
	const drawnBars = bars(shownBars(record, options), circle, middle.reach);
	const drawnSites = sites(shownSites(record, options), circle);
	const drawnMarks = marks(shownMarks(record, options), circle);
	const backboneEdge = circle.radius + BACKBONE / 2;
	const drawing = Math.max(
		backboneEdge,
		...drawnSites.map(
			({ arrow }) => arrow.radius + arrow.width / 2 + overhang(arrow.width),
		),
	);
	const midway = ({ start, end }: Span) => angleOf((start + end) / 2, circle);
	const outside: Outside[] = [
		...drawnBars.flatMap(({ label, hull, name }) =>
			name === null && label.name.trim()
				? [{ label, angle: midway(hull), inward: false }]
				: [],
		),
		...drawnSites.map(({ label, hull }) => ({
			label,
			angle: midway(hull),
			inward: false,
		})),
		...shownCuts(record, options).map(({ label, at }) => ({
			label,
			angle: angleOf(at, circle),
			inward: true,
		})),
		...drawnMarks.map(({ label, angle }) => ({ label, angle, inward: true })),
	];
	const unplaced: Unplaced[] = outside.map(({ label, angle }) => ({
		...labelSize(label),
		anchor: xy(drawing + ANCHOR, angle),
	}));
	const order = [...outside.keys()].sort((i, j) =>
		hidingOrder(outside[i].label, outside[j].label),
	);
	const cap = REACH + circle.radius - RADIUS;
	const { placed, hidden } = columns(unplaced, order, drawing, cap);
	const shapes: Shape[] = [
		...backbone(circle),
		...ruler(circle),
		...drawnBars.flatMap((bar) => tipped(barShapes(bar), bar.label)),
		...drawnSites.flatMap(({ arrow, label }) =>
			tipped([arrowShape(arrow)], label),
		),
		...drawnMarks.flatMap(({ bar, label }) => tipped([bar], label)),
	];
	const boxes: Box[] = [];
	for (const [i, one] of placed.entries()) {
		if (!one) continue;
		const { label, angle, inward } = outside[i];
		const [from, to] = one.leader;
		const leaders = [leader(from, to)];
		if (inward) leaders.unshift(leader(xy(backboneEdge, angle), from));
		shapes.push(...tipped([...leaders, ...labelShapes(label, one.box)], label));
		boxes.push(one.box);
	}
	shapes.push(...middle.shapes);
	const square = drawing + ANCHOR;
	const covered = aroundBoxes(
		[
			{ x: -square, y: -square, width: 2 * square, height: 2 * square },
			...boxes,
		],
		MARGIN,
	);
	const left = hidden.map((i) => outside[i].label);
	const notice = noticeShapes(
		left,
		covered.x + covered.width - MARGIN,
		covered.y + covered.height - MARGIN,
	);
	shapes.push(...notice);
	const below = notice.flatMap((s) => boxOf(s) ?? []);
	return {
		extent: below.length
			? aroundBoxes([covered, aroundBoxes(below, MARGIN)])
			: covered,
		shapes,
		hidden: left.map(hiddenOf),
	};
}

function leader(from: Point, to: Point): Shape {
	return {
		shape: "line",
		x1: from.x,
		y1: from.y,
		x2: to.x,
		y2: to.y,
		stroke: LEADER,
		strokeWidth: LEADER_WIDTH,
	};
}

/**
 * Each of `shown`, an insertion or a disagreement at a point, as a bar across the backbone at its
 * point in its colour, with its label, and its name and point on hover.
 */
function marks(
	shown: readonly Mark[],
	circle: Circle,
): { bar: Shape; label: Label; angle: number }[] {
	return shown.map(({ at, label, hover }) => {
		const angle = angleOf(at, circle);
		const [x1, y1] = pointAt(inside(circle) - INSERTION_REACH, angle);
		const [x2, y2] = pointAt(
			circle.radius + BACKBONE / 2 + INSERTION_REACH,
			angle,
		);
		const bar: Shape = {
			shape: "line",
			x1,
			y1,
			x2,
			y2,
			stroke: label.color,
			strokeWidth: INSERTION_WIDTH,
			title: hover,
		};
		return { bar, label, angle };
	});
}

/** The angle of `position`, in radians clockwise from the top. */
function angleOf(position: number, { length, turn }: Circle): number {
	return (2 * Math.PI * position) / length + turn;
}

/** The point `radius` from the centre at `angle`. */
function pointAt(radius: number, angle: number): [number, number] {
	return [radius * Math.sin(angle), -radius * Math.cos(angle)];
}

function xy(radius: number, angle: number): Point {
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
 * The arrows of each of `shown`, a feature or a disagreement over a span, on rings inside the
 * ruler, each ring as far in as the room allows and no nearer the centre than `clear`.
 */
function bars(
	shown: readonly ColoredFeature[],
	circle: Circle,
	clear: number,
): CircleBar[] {
	const hulls = shown.map(({ feature }) => hullOf(feature, circle.length));
	const onRing = rings(hulls, circle);
	const count = Math.max(0, ...onRing) + 1;
	const outer =
		inside(circle) -
		TICK -
		2 * PAD_Y -
		height("sans", SMALL_SIZE) -
		OVERHANG -
		SHAFT / 2;
	// The innermost shaft and its heads reach in this many steps past its middle.
	const half = (SHAFT / 2 + OVERHANG) / RING_STEP;
	// A name wider than the circle's room would leave a step below 0.
	const step = Math.max(
		0,
		Math.min(
			RING_STEP,
			count > 1 ? (outer - CENTRE * circle.radius) / (count - 1) : RING_STEP,
			(outer - clear) / (count - 1 + half),
		),
	);
	const width = (SHAFT * step) / RING_STEP;
	return shown.map(({ feature, label, segments }, i) => {
		const radius = outer - onRing[i] * step;
		const last = segments.length - 1;
		const [startHead, endHead] = headsOn(feature.strand);
		const arrows = segments.map((segment, k): Arrow => {
			const headStart = k === 0 && startHead;
			const headEnd = k === last && endHead;
			const heads = Number(headStart) + Number(headEnd);
			const start = angleOf(segment.start, circle);
			const end = angleOf(segment.end, circle);
			return {
				start,
				end,
				radius,
				width,
				color: segment.color,
				headStart,
				headEnd,
				head: heads ? Math.min(HEAD / radius, (end - start) / heads) : 0,
			};
		});
		return {
			label,
			arrows,
			hull: hulls[i],
			name: nameOn(label.name, roomiest(arrows, room)),
		};
	});
}

/** The angle an arrow's shaft runs, less its heads. */
function room(arrow: Arrow): number {
	const heads = Number(arrow.headStart) + Number(arrow.headEnd);
	return arrow.end - arrow.start - arrow.head * heads;
}

/**
 * `name` set along the middle of `arrow`'s shaft, upright on the lower half, or `null` when it
 * does not fit.
 *
 * Each letter's box is as wide as its advance and as tall as the face, centred on the shaft's
 * middle and turned square to it. The name fits when it spans, with `PAD_X` at each end, no more
 * of the shaft's middle than the heads leave, and no letter's corner passes the shaft's outer edge.
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
function rings(hulls: readonly Span[], { length, radius }: Circle): number[] {
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

/** A bar's arrows, each joined to the next by a thin arc across any gap between them. */
function barShapes({ label, arrows, name }: CircleBar): Shape[] {
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
	shapes.push(...arrows.map(arrowShape));
	if (name) shapes.push(name);
	return shapes;
}

function arrowShape(arrow: Arrow): Shape {
	return {
		shape: "path",
		commands: outline(arrow),
		fill: arrow.color,
		stroke: shaded(arrow.color),
		strokeWidth: OUTLINE_WIDTH,
	};
}

/**
 * Each of `shown`, a primer site or a read, as a thin arrow outside the backbone, its head at the
 * 3' end, overlapping ones on rings further out, and its label: its name and the bases it spans.
 */
function sites(
	shown: readonly Aligned[],
	circle: Circle,
): { arrow: Arrow; label: Label; hull: Span }[] {
	const hulls = shown.map(({ start, end }) => ({ start, end }));
	const onRing = rings(hulls, circle);
	const beyond = overhang(PRIMER_SHAFT);
	const step = PRIMER_SHAFT + 2 * beyond + PRIMER_GAP;
	const first =
		circle.radius + BACKBONE / 2 + PRIMER_GAP + beyond + PRIMER_SHAFT / 2;
	return shown.map(({ start: from, end: to, strand, label }, i) => {
		const hull = hulls[i];
		const radius = first + onRing[i] * step;
		const start = angleOf(from, circle);
		const end = angleOf(to, circle);
		const [headStart, headEnd] = headsOn(strand);
		const arrow: Arrow = {
			start,
			end,
			radius,
			width: PRIMER_SHAFT,
			color: label.color,
			headStart,
			headEnd,
			head: Math.min(HEAD / radius, end - start),
		};
		return { arrow, label, hull };
	});
}

/** An arrow's outline: its shaft, with a head at each end it points to. */
function outline(arrow: Arrow): PathCommand[] {
	const { radius, width, start, end, head } = arrow;
	const beyond = overhang(arrow.width);
	const first = arrow.headStart ? start + head : start;
	const last = arrow.headEnd ? end - head : end;
	const outer = radius + width / 2;
	const inner = radius - width / 2;
	const to = (r: number, angle: number) => ["L", ...pointAt(r, angle)] as const;
	const commands: PathCommand[] = arrow.headStart
		? [
				["M", ...pointAt(radius, start)],
				to(outer + beyond, first),
				to(outer, first),
			]
		: [["M", ...pointAt(outer, first)]];
	commands.push(...arc(outer, first, last));
	if (arrow.headEnd) {
		commands.push(
			to(outer + beyond, last),
			to(radius, end),
			to(inner - beyond, last),
		);
	}
	commands.push(to(inner, last), ...arc(inner, last, first));
	if (arrow.headStart) commands.push(to(inner - beyond, first));
	commands.push(["Z"]);
	return commands;
}

/** Where the backbone's inner strand ends, inside it. */
function inside({ radius }: Circle): number {
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
function ruler(circle: Circle): Shape[] {
	const { length } = circle;
	const from = inside(circle);
	const middle = from - TICK - PAD_Y - height("sans", SMALL_SIZE) / 2;
	const rise = baseline("sans", SMALL_SIZE, 0);
	const shapes: Shape[] = [];
	const step = tickStep(length);
	for (let position = step; position < length; position += step) {
		const angle = angleOf(position, circle);
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
 * their corners reach. A name too wide to fit inside `CENTRE` of the radius wraps onto lines that
 * do.
 */
function centre(
	name: string,
	circle: Circle,
): { shapes: Shape[]; reach: number } {
	const room = CENTRE * circle.radius;
	const length = `${circle.length} bp`;
	const block = (named: readonly string[]) => {
		const lines = titleLines(named, length);
		const tall = lines.reduce((sum, [, f, size]) => sum + height(f, size), 0);
		const wide = Math.max(...lines.map(([t, f, size]) => measure(t, f, size)));
		return { lines, tall, reach: Math.hypot(wide / 2, tall / 2) };
	};
	let found = block(name.trim() ? [name] : []);
	for (let count = 2; found.reach > room; count++) {
		const tall =
			count * height("sans-bold", NAME_SIZE) + height("sans", SMALL_SIZE);
		if (tall >= 2 * room) break;
		const width = 2 * Math.sqrt(room ** 2 - (tall / 2) ** 2);
		const named = wrap(name, "sans-bold", NAME_SIZE, width, "-_");
		if (named.length <= count) found = block(named);
	}
	return {
		shapes: titleShapes(found.lines, 0, -found.tall / 2),
		reach: found.reach,
	};
}

/** The two strands, from the origin round, and the origin's tick inside them. */
function backbone(circle: Circle): Shape[] {
	const { radius, turn } = circle;
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
	const [x1, y1] = pointAt(inside(circle), turn);
	const [x2, y2] = pointAt(inside(circle) - ORIGIN_TICK, turn);
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
