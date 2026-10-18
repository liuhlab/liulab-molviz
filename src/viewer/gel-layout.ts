/**
 * The gel: a ladder and its lanes laid out as a scene of shapes and text in points, x to the
 * right and y down, from (0, 0) at the drawing's top left.
 */

import type { Gel } from "./gel";
import type { Scene, Shape } from "./scene";
import { baseline, type Face, measure, wrap } from "./text";

const MARGIN = 10;
/** The least width a drawing takes, so a gel of few lanes still has room for its legend. */
const MIN_WIDTH = 240;

const TITLE_SIZE = 13;
/** The room between the title and the lane marks. */
const TITLE_GAP = 6;
/** The size of every text but the title. */
const TEXT_SIZE = 10;
/** A line of text's height, per unit of its size. */
const LEADING = 1.3;
/** The room between the lane marks and the gel. */
const MARKS_GAP = 5;
/** The room between a ladder size and the gel. */
const SIZE_GAP = 5;
/** The room between the gel and the legend. */
const LEGEND_GAP = 10;
/** The room between a legend line's mark and its text. */
const MARK_GAP = 6;

// A lane: its width, and the room between two lanes and at each side of the gel.
const LANE = 38;
const LANE_GAP = 10;

// The gel down from its top: to the largest band, the run to the smallest, and on to its foot.
const RUN_TOP = 26;
const RUN = 210;
const RUN_FOOT = 16;
const GEL_CORNER = 6;

// The well at a lane's head: how far under the gel's top, and how deep.
const WELL_TOP = 8;
const WELL_DEPTH = 6;

// A band: how far in from its lane's sides, how thick, and its corners.
const BAND_INSET = 3;
const BAND_THICKNESS = 4;
const BAND_CORNER = 1.5;

const GEL_FILL = "#15171c";
const WELL_FILL = "#030407";
const BAND_FILL = "#f3f0ff";
const LADDER_FILL = "#a9bbff";
const INK = "#1c1e21";
const SIZE_INK = "#5c626b";

/** A lane as drawn: its mark over the gel, its bands, and its line of the legend. */
interface Lane {
	readonly mark: string;
	readonly bands: readonly number[];
	readonly caption: string;
}

/** Lay out `gel`: the ladder first, then its lanes in the order given. */
export function layoutGel(gel: Gel): Scene {
	const lanes: Lane[] = [
		{ mark: "L", bands: gel.ladder.bands, caption: gel.ladder.name },
		...gel.lanes.map((lane, i) => ({
			mark: String(i + 1),
			bands: lane.bands,
			caption: caption(lane),
		})),
	];
	const run = runOf(lanes.flatMap((lane) => lane.bands));
	const ladderSizes = [...new Set(gel.ladder.bands)].sort((a, b) => b - a);
	const sizeWidth = Math.max(
		...ladderSizes.map((bp) => measure(String(bp), "sans", TEXT_SIZE)),
	);
	const left = MARGIN + sizeWidth + SIZE_GAP;
	const gelWidth = lanes.length * (LANE + LANE_GAP) + LANE_GAP;
	const gelHeight = RUN_TOP + RUN + RUN_FOOT;
	const width = Math.max(MIN_WIDTH, left + gelWidth + MARGIN);

	const shapes: Shape[] = [];
	const title = wrap(
		gel.title ?? "",
		"sans-bold",
		TITLE_SIZE,
		width - 2 * MARGIN,
	);
	const titleEnd = lines(
		shapes,
		title,
		"sans-bold",
		TITLE_SIZE,
		MARGIN,
		MARGIN,
	);
	const top =
		titleEnd + (title.length ? TITLE_GAP : 0) + LEADING * TEXT_SIZE + MARKS_GAP;
	const at = (bp: number) => top + RUN_TOP + run(bp) * RUN;

	shapes.push(rect(left, top, gelWidth, gelHeight, GEL_FILL, GEL_CORNER));
	// A size is labelled only if it sits a text size or more under the last one labelled.
	let last = Number.NEGATIVE_INFINITY;
	for (const bp of ladderSizes) {
		if (at(bp) - last < TEXT_SIZE) continue;
		const label = String(bp);
		const x = left - SIZE_GAP - measure(label, "sans", TEXT_SIZE);
		const lineTop = at(bp) - (LEADING * TEXT_SIZE) / 2;
		shapes.push(text(label, "sans", TEXT_SIZE, x, lineTop, "start", SIZE_INK));
		last = at(bp);
	}
	for (const [k, { mark, bands }] of lanes.entries()) {
		const x = left + LANE_GAP + k * (LANE + LANE_GAP);
		const markTop = top - MARKS_GAP - LEADING * TEXT_SIZE;
		shapes.push(
			text(mark, "sans-bold", TEXT_SIZE, x + LANE / 2, markTop, "middle", INK),
			rect(x, top + WELL_TOP, LANE, WELL_DEPTH, WELL_FILL, 0),
			...bands.map((bp) =>
				rect(
					x + BAND_INSET,
					at(bp) - BAND_THICKNESS / 2,
					LANE - 2 * BAND_INSET,
					BAND_THICKNESS,
					k === 0 ? LADDER_FILL : BAND_FILL,
					BAND_CORNER,
					`${bp} bp`,
				),
			),
		);
	}
	const bottom = legend(shapes, lanes, top + gelHeight + LEGEND_GAP, width);
	return { extent: { x: 0, y: 0, width, height: bottom + MARGIN }, shapes };
}

/**
 * Add to `shapes` a line of the legend for each lane, from the height `top`: its mark, then
 * its caption, wrapped to `width` less the margins at a hanging indent. Returns where it ends.
 */
function legend(
	shapes: Shape[],
	lanes: readonly Lane[],
	top: number,
	width: number,
): number {
	const markWidth = Math.max(
		...lanes.map(({ mark }) => measure(mark, "sans-bold", TEXT_SIZE)),
	);
	const textLeft = MARGIN + markWidth + MARK_GAP;
	let y = top;
	for (const { mark, caption } of lanes) {
		shapes.push(text(mark, "sans-bold", TEXT_SIZE, MARGIN, y, "start", INK));
		const wrapped = wrap(caption, "sans", TEXT_SIZE, width - MARGIN - textLeft);
		const end = lines(shapes, wrapped, "sans", TEXT_SIZE, textLeft, y);
		y = Math.max(end, y + LEADING * TEXT_SIZE);
	}
	return y;
}

/** Add `wrapped` to `shapes`, one line under another from `top` at `x`. Returns where they end. */
function lines(
	shapes: Shape[],
	wrapped: readonly string[],
	face: Face,
	size: number,
	x: number,
	top: number,
): number {
	for (const [i, line] of wrapped.entries()) {
		shapes.push(
			text(line, face, size, x, top + i * LEADING * size, "start", INK),
		);
	}
	return top + wrapped.length * LEADING * size;
}

/** `lane`'s line of the legend: its name and its sizes in the order given, or no band. */
function caption(lane: Gel["lanes"][number]): string {
	const listed = lane.bands.length ? `${lane.bands.join(", ")} bp` : "no band";
	return lane.name ? `${lane.name}: ${listed}` : listed;
}

/**
 * How far a band of each size runs, from 0 for the largest of `bands` to 1 for the smallest,
 * linear in the log of its size; one half when all are one size.
 */
function runOf(bands: readonly number[]): (bp: number) => number {
	const top = Math.log10(Math.max(...bands));
	const bottom = Math.log10(Math.min(...bands));
	return (bp) =>
		top === bottom ? 0.5 : (top - Math.log10(bp)) / (top - bottom);
}

/** `content` set in a line of text whose top is `top`. */
function text(
	content: string,
	face: Face,
	size: number,
	x: number,
	top: number,
	anchor: "start" | "middle",
	fill: string,
): Shape {
	const y = baseline(face, size, top + (LEADING * size) / 2);
	return { shape: "text", text: content, face, size, x, y, anchor, fill };
}

function rect(
	x: number,
	y: number,
	width: number,
	height: number,
	fill: string,
	corner: number,
	hover?: string,
): Shape {
	return {
		shape: "rect",
		x,
		y,
		width,
		height,
		corner,
		fill,
		stroke: "none",
		strokeWidth: 0,
		hover,
	};
}
