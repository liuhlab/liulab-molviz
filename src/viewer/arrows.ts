/** Arrows along a line or a row, and a feature's bars of them: tiers, outlines and names. */

import { LABEL_SIZE, type Label, PAD_X } from "./labels";
import type { Piece } from "./pieces";
import type { Record } from "./record";
import { height, measure } from "./text";

// A feature's arrow: the band's thickness, how far a head reaches beyond the band, the least room
// between two bars in a tier, and between tiers.
export const BAND = 15;
export const OVERHANG = 4;
const HEAD = 12;
const BAR_GAP = 3;
export const TIER_GAP = 4;

/** One segment's arrow along the line. */
export interface Arrow {
	readonly start: number;
	readonly end: number;
	readonly color: string;
	readonly headStart: boolean;
	readonly headEnd: boolean;
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

type Feature = Record["features"][number];

/** The bars `found` draws, each run of pieces that follow on from one another, named by `label`. */
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

/** An arrow's band less its heads, as where it starts and ends. */
export function body(arrow: Arrow): [number, number] {
	const heads = Number(arrow.headStart) + Number(arrow.headEnd);
	const head = heads ? Math.min(HEAD, (arrow.end - arrow.start) / heads) : 0;
	return [
		arrow.headStart ? arrow.start + head : arrow.start,
		arrow.headEnd ? arrow.end - head : arrow.end,
	];
}

export function middleOf([first, last]: [number, number]): number {
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
export function places(
	bars: readonly Bar[],
	tiers: readonly number[],
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

/**
 * The outline of `arrow` about the height `middle`: its band `band` thick, and a head at each end
 * it has.
 */
export function outline(
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
export function overhang(band: number): number {
	return (band * OVERHANG) / BAND;
}
