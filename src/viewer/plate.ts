/**
 * The plate: its format, a grid of wells and the text of what each well holds, and its layout, a
 * scene of shapes and text in points, x to the right and y down, from (0, 0) at the drawing's top
 * left.
 */

import * as v from "valibot";
import { exact, keyed, PositiveInteger, parse, Text } from "./format";
import {
	INK,
	lines,
	MARGIN,
	MIN_WIDTH,
	TITLE_GAP,
	TITLE_SIZE,
} from "./furniture";
import type { Scene, Shape } from "./scene";
import { measure, wrap } from "./text";

/** A well's place on its plate, each counted from 0. */
export interface Place {
	readonly row: number;
	readonly column: number;
}

const WELL_NAME = /^([A-Z]+)([1-9][0-9]*)$/;

/** Return a 0-based row's letters: `A` to `Z`, then `AA` on. */
export function rowLabel(row: number): string {
	let letters = "";
	for (let rest = row + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
		letters = String.fromCharCode(65 + ((rest - 1) % 26)) + letters;
	}
	return letters;
}

/** Return the name of the well at `place`, such as `B3` for row 1 and column 2. */
export function wellName({ row, column }: Place): string {
	return `${rowLabel(row)}${column + 1}`;
}

/** Return the place a well name such as `B3` names, or `undefined` where it names none. */
export function wellAt(name: string): Place | undefined {
	const match = WELL_NAME.exec(name);
	if (!match) return undefined;
	const [, letters = "", digits = ""] = match;
	let row = 0;
	for (const letter of letters) row = row * 26 + letter.charCodeAt(0) - 64;
	return { row: row - 1, column: Number(digits) - 1 };
}

/** How many rows and columns a plate's well names are checked against. */
interface Size {
	readonly rows: number;
	readonly columns: number;
}

/**
 * Where `rows` or `columns` is malformed the size is unbounded, so a well name is checked
 * only for its form.
 */
function sizeOf(input: unknown): Size {
	const { rows, columns } = (
		typeof input === "object" && input !== null ? input : {}
	) as { rows?: unknown; columns?: unknown };
	if (v.is(PositiveInteger, rows) && v.is(PositiveInteger, columns))
		return { rows, columns };
	return { rows: Number.POSITIVE_INFINITY, columns: Number.POSITIVE_INFINITY };
}

const Contents = v.pipe(
	Text,
	v.check((text) => text.trim() !== "", "must not be blank"),
);

/** What is wrong with a well name on a plate of `size`, or `undefined` where nothing is. */
function nameProblem(
	name: string,
	{ rows, columns }: Size,
): string | undefined {
	const place = wellAt(name);
	if (!place) return "not a well name, such as B3";
	if (place.row < rows && place.column < columns) return undefined;
	return `not on the plate, which runs A1 to ${wellName({ row: rows - 1, column: columns - 1 })}`;
}

/** Each well's contents, by a name the plate has. */
function wells(size: Size) {
	return keyed(v.record(v.string(), Contents, "must be an object"), (key) =>
		nameProblem(key, size),
	);
}

function plateSchema(size: Size) {
	return exact({
		title: v.optional(Text),
		rows: PositiveInteger,
		columns: PositiveInteger,
		wells: v.optional(wells(size)),
	});
}

/** A plate as a caller hands it over. */
export type Plate = v.InferOutput<ReturnType<typeof plateSchema>>;

/** Return `input` as a typed plate, or throw one FormatError naming every problem by its path. */
export function checkPlate(input: unknown): Plate {
	return parse(plateSchema(sizeOf(input)), input, { name: "plate" });
}

/** The widest the grid is laid out, its margins included, before its wells shrink to fit. */
const MAX_WIDTH = 540;
/** The widest a well's pitch is, so a small plate does not draw a wall of discs. */
const MAX_PITCH = 26;
/** The room between two wells, per unit of pitch. */
const WELL_GAP = 0.18;

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

// The legend: how far under the grid, its text's size and leading, a swatch's diameter, the
// room between a swatch and its text, and between two entries side by side.
const LEGEND_GAP = 8;
const LEGEND_SIZE = 9;
const LEGEND_LEADING = 13 / 9;
const SWATCH = 9;
const SWATCH_GAP = 4;
const ENTRY_GAP = 12;

/** A line of the legend: a swatch of its colour, and its text. */
interface Entry {
	readonly fill: string;
	readonly text: string;
}

/** A well of a plate: its place, its name, and its contents where it holds any. */
interface Well {
	readonly place: Place;
	readonly name: string;
	readonly contents: string | undefined;
}

/**
 * Lay out `plate`: its title, its column numbers and row letters, every well, and under them
 * a legend of its contents, or past the palette's length a count of them.
 */
export function layoutPlate(plate: Plate): Scene {
	const { rows, columns } = plate;
	const different = differentContents(plate);
	const entries: Entry[] =
		different.length > PALETTE.length
			? [
					{
						fill: PALETTE[0],
						text: `${different.length} different contents, all one colour`,
					},
				]
			: different.map((text, i) => ({ fill: PALETTE[i], text }));
	const fills = new Map(entries.map(({ text, fill }) => [text, fill]));

	const pitch = Math.min(MAX_PITCH, (MAX_WIDTH - 2 * MARGIN) / (columns + 1));
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
	const titleEnd = lines(
		shapes,
		title,
		"sans-bold",
		TITLE_SIZE,
		MARGIN,
		MARGIN,
	);
	const top = titleEnd + (title.length ? TITLE_GAP : 0) + pitch;

	for (const number of numbered(columns, pitch, size)) {
		const x = left + (number - 0.5) * pitch;
		const y = top - COLUMN_RISE * pitch;
		shapes.push(axisLabel(String(number), size, x, y, "middle"));
	}
	for (const { place, name, contents } of inReadingOrder(plate)) {
		const { row, column } = place;
		if (column === 0) {
			const label = letters[row];
			const x = left - ROW_GAP * pitch - measure(label, "sans", size);
			const y = top + (row + ROW_DROP) * pitch;
			shapes.push(axisLabel(label, size, x, y, "start"));
		}
		const [fill, title] =
			contents === undefined
				? [EMPTY, name]
				: [fills.get(contents) ?? PALETTE[0], `${name}: ${contents}`];
		const x = left + column * pitch + (pitch - well) / 2;
		const y = top + row * pitch + (pitch - well) / 2;
		shapes.push(disc(x, y, well, fill, title));
	}
	const grid = top + rows * pitch;
	const bottom = entries.length
		? legend(shapes, entries, grid + LEGEND_GAP, width - 2 * MARGIN)
		: grid;
	return { extent: { x: 0, y: 0, width, height: bottom + MARGIN }, shapes };
}

/** Each well of `plate`, row by row and each row left to right. */
function* inReadingOrder(plate: Plate): Generator<Well> {
	for (let row = 0; row < plate.rows; row++) {
		for (let column = 0; column < plate.columns; column++) {
			const place = { row, column };
			const name = wellName(place);
			yield { place, name, contents: plate.wells?.[name] };
		}
	}
}

/** Each different contents of `plate` once, in the order its wells are read. */
function differentContents(plate: Plate): string[] {
	const seen = new Set<string>();
	for (const { contents } of inReadingOrder(plate)) {
		if (contents !== undefined) seen.add(contents);
	}
	return [...seen];
}

/**
 * The columns numbered over a grid of `columns` at `pitch`: the first, and each multiple of the
 * least of 1, 2 or 5 times a power of ten at which no number runs into the next.
 */
function numbered(columns: number, pitch: number, size: number): number[] {
	const half = (column: number) => measure(String(column), "sans", size) / 2;
	for (let power = 1; ; power *= 10) {
		for (const factor of [1, 2, 5]) {
			const step = factor * power;
			const picked = [1];
			for (let column = step; column <= columns; column += step) {
				if (column > 1) picked.push(column);
			}
			const clear = picked.every(
				(column, i) =>
					i === 0 ||
					(column - picked[i - 1]) * pitch >=
						half(column) + half(picked[i - 1]),
			);
			if (clear) return picked;
		}
	}
}

/**
 * Add `entries` to `shapes` from the height `top`, side by side as many as fit in `room`, each
 * given the width of the widest, read row by row. An entry too long for `room` wraps past its
 * swatch. Returns where the legend ends.
 */
function legend(
	shapes: Shape[],
	entries: readonly Entry[],
	top: number,
	room: number,
): number {
	const indent = SWATCH + SWATCH_GAP;
	const wrapped = entries.map(({ text }) =>
		wrap(text, "sans", LEGEND_SIZE, room - indent),
	);
	const widest = Math.max(
		0,
		...wrapped.flat().map((l) => measure(l, "sans", LEGEND_SIZE)),
	);
	const entryWidth = indent + widest + ENTRY_GAP;
	const perRow = Math.max(1, Math.floor((room + ENTRY_GAP) / entryWidth));
	let y = top;
	for (let first = 0; first < entries.length; first += perRow) {
		let bottom = y;
		for (let i = first; i < Math.min(first + perRow, entries.length); i++) {
			const x = MARGIN + (i - first) * entryWidth;
			const middle = y + (LEGEND_LEADING * LEGEND_SIZE) / 2;
			shapes.push(disc(x, middle - SWATCH / 2, SWATCH, entries[i].fill));
			const end = lines(
				shapes,
				wrapped[i],
				"sans",
				LEGEND_SIZE,
				x + indent,
				y,
				{
					leading: LEGEND_LEADING,
				},
			);
			bottom = Math.max(bottom, end);
		}
		y = bottom;
	}
	return y;
}

/** A row's letters or a column's number at `size`, in the ink, on the baseline `y`. */
function axisLabel(
	content: string,
	size: number,
	x: number,
	y: number,
	anchor: "start" | "middle",
): Shape {
	return {
		shape: "text",
		text: content,
		face: "sans",
		size,
		x,
		y,
		anchor,
		fill: INK,
	};
}

/** A circle `diameter` across, its box's top left at (`x`, `y`), outlined as a well is. */
function disc(
	x: number,
	y: number,
	diameter: number,
	fill: string,
	title?: string,
): Shape {
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
		title,
	};
}
