/** Arrows along a line or a row, and a feature's bars of them: tiers, outlines and names. */

import {
	disagreementLabel,
	LABEL_SIZE,
	type Label,
	labelOf,
	PAD_X,
	PAD_Y,
	tipOf,
} from "./labels";
import type { Options } from "./options";
import {
	CONNECTOR,
	CONNECTOR_WIDTH,
	colorOf,
	INK,
	OUTLINE_WIDTH,
	painted,
	shaded,
	textColor,
} from "./paint";
import { type Piece, spansText } from "./pieces";
import { type Feature, type Record, recordBounds, type Span } from "./record";
import type { Shape } from "./scene";
import { baseline, height, measure } from "./text";

// A feature's arrow: the shaft's thickness, how far a head reaches beyond the shaft, the least room
// between two bars in a tier, and between tiers.
export const SHAFT = 15;
export const OVERHANG = 4;
export const HEAD = 12;
const BAR_GAP = 3;
export const TIER_GAP = 4;

/** How deep the teeth of a zigzag edge are. */
const ZIGZAG = 4;

// A primer's arrow: its shaft's thickness, and the room either side of it.
export const PRIMER_SHAFT = 4;
export const PRIMER_GAP = 2;

/** An arrow's head: how far along the shaft it runs, and how far beyond the shaft it reaches. */
export interface Head {
	readonly length: number;
	readonly reach: number;
}

/** One segment's arrow along the line. */
export interface Arrow {
	readonly start: number;
	readonly end: number;
	readonly color: string;
	readonly headStart: boolean;
	readonly headEnd: boolean;
	/** Whether the span or a row cuts it at `start`, and at `end`. */
	readonly cutStart: boolean;
	readonly cutEnd: boolean;
}

/** Pieces of a feature that follow on from one another, drawn as one bar in one tier. */
export interface Bar {
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
export type Place = { inside: Arrow } | { under: number } | "boxed" | null;

/** A feature as a map or a row draws it: its label, and its segments in their colours. */
export interface ColoredFeature {
	readonly feature: Feature;
	readonly label: Label;
	readonly segments: readonly (Span & { readonly color: string })[];
}

/** Each feature of `record` whose type `options` leave on, dimmed where they leave it unlit. */
export function coloredFeatures(
	record: Record,
	options: Options,
): ColoredFeature[] {
	const off = new Set(options.types_off);
	return record.features
		.filter((feature) => !off.has(feature.type))
		.map((feature) => {
			const spans = feature.segments.map(({ start, end }) => ({ start, end }));
			const bases = spans.reduce((sum, { start, end }) => sum + end - start, 0);
			const label = labelOf(
				{ kind: "features", name: feature.name, spans },
				[{ text: feature.name, face: "sans" }],
				tipOf(
					feature.name,
					feature.type,
					spansText(spans, record.bases.length),
					bases,
				),
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
 * Each disagreement of `record` over a span, as a feature of no type on no strand in its colour,
 * dimmed where `options` leave it unlit. No feature type turns one off.
 */
export function disagreementBars(
	record: Record,
	options: Options,
): ColoredFeature[] {
	const bounds = recordBounds(record);
	return record.disagreements.flatMap((disagreement) => {
		if (disagreement.at !== undefined) return [];
		const { name, start, end } = disagreement;
		const { label } = disagreementLabel(
			disagreement,
			bounds,
			options.highlight,
		);
		const feature: Feature = {
			name,
			type: "",
			strand: 0,
			segments: [{ start, end }],
		};
		return [{ feature, label, segments: [{ start, end, color: label.color }] }];
	});
}

/** Whether an arrow on `strand` has a head where it starts, and where it ends. */
export function headsOn(strand: number): [start: boolean, end: boolean] {
	return [strand === -1 || strand === 2, strand === 1 || strand === 2];
}

/**
 * The bars `found` draws, each run of pieces that follow on from one another, named by `label`.
 * A run of a gap alone is a bar with no arrows.
 */
export function barsOf(
	feature: Feature,
	label: Label,
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
	const [headStart, headEnd] = headsOn(feature.strand);
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
				headStart: piece.starts && headStart,
				headEnd: piece.ends && headEnd,
				cutStart: piece.cutStart,
				cutEnd: piece.cutEnd,
			});
		}
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
export function pack(
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

export function isUnder(place: Place): place is { under: number } {
	return typeof place === "object" && place !== null && "under" in place;
}

/** An arrow's shaft less its heads, each `length` long, as where it starts and ends. */
function body(arrow: Arrow, length = HEAD): [number, number] {
	const heads = Number(arrow.headStart) + Number(arrow.headEnd);
	const head = heads ? Math.min(length, (arrow.end - arrow.start) / heads) : 0;
	return [
		arrow.headStart ? arrow.start + head : arrow.start,
		arrow.headEnd ? arrow.end - head : arrow.end,
	];
}

function middleOf([first, last]: [number, number]): number {
	return (first + last) / 2;
}

/**
 * Whether `outline`, given `zigzag`, cuts a zigzag edge into the start of `arrow`, and into its
 * end, the shaft left by its heads running from `first` to `last`.
 */
function teeth(
	arrow: Arrow,
	first: number,
	last: number,
	zigzag: boolean,
): [start: boolean, end: boolean] {
	// Teeth need room on the shaft, which a head may fill.
	const fit = zigzag && last - first >= 2 * ZIGZAG;
	return [
		fit && arrow.cutStart && !arrow.headStart,
		fit && arrow.cutEnd && !arrow.headEnd,
	];
}

/** An arrow's shaft less its heads and less the teeth of any zigzag edge `zigzag` gives it. */
function clear(arrow: Arrow, zigzag: boolean): [number, number] {
	const [first, last] = body(arrow);
	const [start, end] = teeth(arrow, first, last, zigzag);
	return [start ? first + ZIGZAG : first, end ? last - ZIGZAG : last];
}

function room(arrow: Arrow, zigzag: boolean): number {
	const [first, last] = clear(arrow, zigzag);
	return last - first;
}

/** The first of `arrows` with the most room for a name, as `room` measures it. */
export function roomiest<T>(
	arrows: readonly T[],
	room: (arrow: T) => number,
): T {
	return arrows.reduce((a, b) => (room(b) > room(a) ? b : a));
}

/**
 * Where each bar's name goes. Inside the arrow with most room, when it fits there clear of any
 * zigzag edge `zigzag` gives it. Otherwise under the bar, centred, and kept from 0 to `width` if
 * given and it fits, when it meets no other bar in its tier and no name already set under one
 * there. Otherwise in a box. A bar with no arrows takes no name.
 */
export function places(
	bars: readonly Bar[],
	tiers: readonly number[],
	width?: number,
	zigzag = false,
): Place[] {
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
			if (!name.trim() || !bar.arrows.length) {
				placed[i] = null;
				continue;
			}
			const wide = measure(name, "sans", LABEL_SIZE);
			const most = roomiest(bar.arrows, (arrow) => room(arrow, zigzag));
			if (wide + 2 * PAD_X <= room(most, zigzag) && lineHeight <= SHAFT) {
				placed[i] = { inside: most };
				continue;
			}
			const centred = (bar.start + bar.end - wide) / 2;
			const left =
				width !== undefined && wide <= width
					? Math.min(Math.max(centred, 0), width - wide)
					: centred;
			const near = inTier.some(
				(j) =>
					j !== i &&
					bars[j].end > left - BAR_GAP &&
					bars[j].start < left + wide + BAR_GAP,
			);
			if (left < last + BAR_GAP || near) continue;
			placed[i] = { under: left };
			last = left + wide;
		}
	}
	return placed;
}

/**
 * The outline of `arrow` about the height `middle`: its shaft `shaft` thick, a head at each end it
 * has, a feature's in proportion unless `head` is given, and with `zigzag` a zigzag edge at each
 * end where it is cut, if its shaft has room.
 */
export function outline(
	arrow: Arrow,
	middle: number,
	shaft = SHAFT,
	zigzag = false,
	head: Head = { length: HEAD, reach: overhang(shaft) },
): [number, number][] {
	const [first, last] = body(arrow, head.length);
	const { reach } = head;
	const top = middle - shaft / 2;
	const bottom = middle + shaft / 2;
	const quarter = shaft / 4;
	const [startTeeth, endTeeth] = teeth(arrow, first, last, zigzag);
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
	} else if (endTeeth) {
		points.push(
			[last - ZIGZAG, middle - quarter],
			[last, middle],
			[last - ZIGZAG, middle + quarter],
		);
	}
	points.push([last, bottom], [first, bottom]);
	if (arrow.headStart) points.push([first, bottom + reach]);
	else if (startTeeth) {
		points.push(
			[first + ZIGZAG, middle + quarter],
			[first, middle],
			[first + ZIGZAG, middle - quarter],
		);
	}
	return points;
}

/**
 * `bar` about the height `middle`: a line across each gap, each arrow, with zigzag edges where it
 * is cut if `zigzag`, and its name where `place` sets it inside or under the bar.
 */
export function barShapes(
	bar: Bar,
	middle: number,
	place: Place,
	zigzag: boolean,
): Shape[] {
	const { dim, name } = bar.label;
	const shapes: Shape[] = [];
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
			points: outline(arrow, middle, SHAFT, zigzag),
			fill: arrow.color,
			stroke: shaded(arrow.color),
			strokeWidth: OUTLINE_WIDTH,
		});
	}
	if (place === "boxed" || place === null) return shapes;
	const lineHeight = height("sans", LABEL_SIZE);
	const [x, fill, textMiddle] =
		"inside" in place
			? [
					middleOf(clear(place.inside, zigzag)),
					textColor(place.inside.color),
					middle,
				]
			: [
					place.under + measure(name, "sans", LABEL_SIZE) / 2,
					painted(INK, dim),
					middle + SHAFT / 2 + OVERHANG + PAD_Y + lineHeight / 2,
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
	return shapes;
}

/** How far the heads of an arrow `shaft` thick reach beyond it, as a feature's do in proportion. */
export function overhang(shaft: number): number {
	return (shaft * OVERHANG) / SHAFT;
}
