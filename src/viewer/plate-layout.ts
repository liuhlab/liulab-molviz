/**
 * The plate: its wells laid out on a grid as a scene of shapes and text in points, x to the
 * right and y down, from (0, 0) at the drawing's top left.
 */

import type { Scene, Shape } from "./line";
import { type Plate, rowLabel, wellName } from "./plate";
import { baseline, type Face, measure, wrap } from "./text";

const MARGIN = 10;
/** The least width a drawing takes, so a narrow plate still has room for its title. */
const MIN_WIDTH = 240;
/** The widest the grid is laid out, its margins included, before its wells shrink to fit. */
const WIDTH = 540;
/** The widest a well's pitch is, so a small plate does not draw a wall of discs. */
const MAX_PITCH = 26;
/** The room between two wells, per unit of pitch. */
const WELL_GAP = 0.18;

const TITLE_SIZE = 13;
/** The room between the title and the column numbers. */
const TITLE_GAP = 6;
/** A line of the title's height, per unit of its size. */
const LEADING = 1.3;

// A row's letters or a column's number: its size per unit of pitch, and the least and most.
const LABEL_SIZE = 0.5;
const LABEL_MIN = 3.5;
const LABEL_MAX = 9;
// Per unit of pitch: how far a column number's baseline sits over the grid, how far a row's
// letters end left of it, and how far their baseline sits down into the row.
const COLUMN_RISE = 0.35;
const ROW_GAP = 0.35;
const ROW_DROP = 0.62;

/**
 * The petroff10 palette, whose colours stay apart for colour-blind readers, given out to a
 * plate's contents in reading order. Past its length, every used well takes the first.
 */
const PALETTE = [
	"#3f90da",
	"#ffa90e",
	"#bd1f01",
	"#94a4a2",
	"#832db6",
	"#a96b59",
	"#e76300",
	"#b9ac70",
	"#717581",
	"#92dadd",
] as const;
const EMPTY = "#f4f4f4";
const RULE = "#bbbbbb";
const RULE_WIDTH = 0.4;
const INK = "#1c1e21";

// The legend: how far under the grid, its text's size and line height, a swatch's diameter,
// the room between a swatch and its text, and between two of its columns.
const LEGEND_GAP = 8;
const LEGEND_SIZE = 9;
const LEGEND_LINE = 13;
const SWATCH = 9;
const SWATCH_GAP = 4;
const COLUMN_GAP = 12;

/** A line of the legend: a swatch of its colour, and what it says. */
interface Entry {
	readonly fill: string;
	readonly said: string;
}

/**
 * Lay out `plate`: its title, its column numbers and row letters, every well, and under them
 * a legend of its contents, or past the palette's length a count of them.
 */
export function layoutPlate(plate: Plate): Scene {
	const { rows, columns } = plate;
	const held = plate.wells ?? {};
	const contents = readingOrder(plate);
	const entries: Entry[] =
		contents.length > PALETTE.length
			? [
					{
						fill: PALETTE[0],
						said: `${contents.length} different contents, all one colour`,
					},
				]
			: contents.map((said, i) => ({ fill: PALETTE[i], said }));
	const fills = new Map(entries.map(({ said, fill }) => [said, fill]));

	const pitch = Math.min(MAX_PITCH, (WIDTH - 2 * MARGIN) / (columns + 1));
	const well = pitch * (1 - WELL_GAP);
	const size = Math.min(LABEL_MAX, Math.max(LABEL_MIN, pitch * LABEL_SIZE));
	const letters = Array.from({ length: rows }, (_, row) => rowLabel(row));
	const widest = letters.reduce(
		(most, l) => Math.max(most, measure(l, "sans", size)),
		0,
	);
	// The row letters take one pitch, or more where they need it.
	const left = MARGIN + Math.max(pitch, ROW_GAP * pitch + widest);
	const width = Math.max(MIN_WIDTH, left + columns * pitch + MARGIN);

	const shapes: Shape[] = [];
	const title = wrap(
		plate.title ?? "",
		"sans-bold",
		TITLE_SIZE,
		width - 2 * MARGIN,
	);
	const line = LEADING * TITLE_SIZE;
	for (const [i, words] of title.entries()) {
		const y = baseline("sans-bold", TITLE_SIZE, MARGIN + (i + 0.5) * line);
		shapes.push(text(words, "sans-bold", TITLE_SIZE, MARGIN, y, "start"));
	}
	const top =
		MARGIN + title.length * line + (title.length ? TITLE_GAP : 0) + pitch;

	for (let column = 0; column < columns; column++) {
		const x = left + (column + 0.5) * pitch;
		const y = top - COLUMN_RISE * pitch;
		shapes.push(text(String(column + 1), "sans", size, x, y, "middle"));
	}
	for (const [row, label] of letters.entries()) {
		const x = left - ROW_GAP * pitch - measure(label, "sans", size);
		shapes.push(
			text(label, "sans", size, x, top + (row + ROW_DROP) * pitch, "start"),
		);
		for (let column = 0; column < columns; column++) {
			const said = held[wellName(row, column)];
			const fill = said === undefined ? EMPTY : (fills.get(said) ?? PALETTE[0]);
			const x = left + column * pitch + (pitch - well) / 2;
			const y = top + row * pitch + (pitch - well) / 2;
			shapes.push(disc(x, y, well, fill));
		}
	}
	const grid = top + rows * pitch;
	const bottom = entries.length
		? legend(shapes, entries, grid + LEGEND_GAP, width - 2 * MARGIN)
		: grid;
	return { extent: { x: 0, y: 0, width, height: bottom + MARGIN }, shapes };
}

/** Each different contents of `plate` once, in the order its wells are read. */
function readingOrder(plate: Plate): string[] {
	const held = plate.wells ?? {};
	const seen = new Set<string>();
	for (let row = 0; row < plate.rows; row++) {
		for (let column = 0; column < plate.columns; column++) {
			const said = held[wellName(row, column)];
			if (said !== undefined) seen.add(said);
		}
	}
	return [...seen];
}

/**
 * Add `entries` to `shapes` from the height `top`, in columns as wide as the widest entry,
 * as many as fit in `room`, read row by row. An entry too long for `room` wraps past its
 * swatch. Returns where the legend ends.
 */
function legend(
	shapes: Shape[],
	entries: readonly Entry[],
	top: number,
	room: number,
): number {
	const indent = SWATCH + SWATCH_GAP;
	const wrapped = entries.map(({ said }) =>
		wrap(said, "sans", LEGEND_SIZE, room - indent),
	);
	const widest = Math.max(
		0,
		...wrapped.flat().map((l) => measure(l, "sans", LEGEND_SIZE)),
	);
	const column = indent + widest + COLUMN_GAP;
	const across = Math.max(1, Math.floor((room + COLUMN_GAP) / column));
	let y = top;
	for (let first = 0; first < entries.length; first += across) {
		let tallest = 1;
		for (let i = first; i < Math.min(first + across, entries.length); i++) {
			const x = MARGIN + (i - first) * column;
			const middle = y + LEGEND_LINE / 2;
			shapes.push(disc(x, middle - SWATCH / 2, SWATCH, entries[i].fill));
			for (const [k, words] of wrapped[i].entries()) {
				const at = baseline("sans", LEGEND_SIZE, middle + k * LEGEND_LINE);
				shapes.push(text(words, "sans", LEGEND_SIZE, x + indent, at, "start"));
			}
			tallest = Math.max(tallest, wrapped[i].length);
		}
		y += tallest * LEGEND_LINE;
	}
	return y;
}

/** `content` in the ink, on the baseline `y`. */
function text(
	content: string,
	face: Face,
	size: number,
	x: number,
	y: number,
	anchor: "start" | "middle",
): Shape {
	return { shape: "text", text: content, face, size, x, y, anchor, fill: INK };
}

/** A circle `diameter` across, its box's top left at (`x`, `y`), outlined as a well is. */
function disc(x: number, y: number, diameter: number, fill: string): Shape {
	return {
		shape: "rect",
		x,
		y,
		width: diameter,
		height: diameter,
		corner: diameter / 2,
		fill,
		stroke: RULE,
		strokeWidth: RULE_WIDTH,
	};
}
