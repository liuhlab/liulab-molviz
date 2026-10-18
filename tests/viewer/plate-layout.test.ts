import { describe, expect, test } from "vitest";
import { checkPlate } from "../../src/viewer/plate";
import { layoutPlate } from "../../src/viewer/plate-layout";
import type { Scene, Shape } from "../../src/viewer/scene";
import { measure } from "../../src/viewer/text";
import eleven from "../plates/eleven-contents.json";
import longLegend from "../plates/long-legend.json";
import oneWell from "../plates/one-well.json";
import sparse from "../plates/sparse-1536.json";
import ten from "../plates/ten-contents.json";

// mbio's petroff10 palette, in order, and its empty-well grey.
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
];
const EMPTY = "#f4f4f4";
const RULE = "#bbbbbb";
const MARGIN = 10;

type Rect = Extract<Shape, { shape: "rect" }>;
type Text = Extract<Shape, { shape: "text" }>;

function lay(plate: unknown): Scene {
	return layoutPlate(checkPlate(plate));
}

/** Every round shape, top to bottom and each line left to right. */
function discs(scene: Scene): Rect[] {
	return scene.shapes
		.filter((s): s is Rect => s.shape === "rect" && s.corner * 2 === s.width)
		.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** The wells in reading order: the first discs, since the legend is under the grid. */
function wells(scene: Scene, count: number): Rect[] {
	return discs(scene).slice(0, count);
}

/** The legend's swatches, in reading order. */
function swatches(scene: Scene, count: number): Rect[] {
	return discs(scene).slice(count);
}

function texts(scene: Scene): Text[] {
	return scene.shapes.filter((s): s is Text => s.shape === "text");
}

/** Where `t` starts and ends across. */
function across(t: Text): [number, number] {
	const width = measure(t.text, t.face, t.size);
	const from = t.anchor === "middle" ? t.x - width / 2 : t.x;
	return [from, from + width];
}

/** Every text and disc of `scene` lies inside its margins, side to side. */
function inside(scene: Scene): boolean {
	const right = scene.extent.width - MARGIN;
	const spans = [
		...texts(scene).map(across),
		...discs(scene).map((d) => [d.x, d.x + d.width]),
	];
	return spans.every(
		([from, to]) => from >= MARGIN - 1e-9 && to <= right + 1e-9,
	);
}

/** The texts under the grid of `count` wells, top to bottom and each line left to right. */
function legend(scene: Scene, count: number): Text[] {
	const last = wells(scene, count).at(-1);
	const foot = last ? last.y + last.height : 0;
	return texts(scene)
		.filter((t) => t.y > foot)
		.sort((a, b) => a.y - b.y || a.x - b.x);
}

describe("layoutPlate", () => {
	test("gives out the palette in reading order, row by row and each row left to right", () => {
		const scene = lay({
			rows: 2,
			columns: 2,
			wells: { B1: "lysate", A2: "water", A1: "primer" },
		});
		expect(wells(scene, 4).map((w) => w.fill)).toEqual([
			PALETTE[0],
			PALETTE[1],
			PALETTE[2],
			EMPTY,
		]);
		expect(legend(scene, 4).map((t) => t.text)).toEqual([
			"primer",
			"water",
			"lysate",
		]);
		expect(swatches(scene, 4).map((s) => s.fill)).toEqual(PALETTE.slice(0, 3));
	});

	test("lists ten contents in the legend, each in its own colour", () => {
		const scene = lay(ten);
		expect(legend(scene, 12).map((t) => t.text)).toEqual(
			Object.values(ten.wells),
		);
		expect(swatches(scene, 12).map((s) => s.fill)).toEqual(PALETTE);
		expect(wells(scene, 12).map((w) => w.fill)).toEqual([
			...PALETTE,
			EMPTY,
			EMPTY,
		]);
	});

	test("past ten contents, fills every used well with one colour and counts them", () => {
		const scene = lay(eleven);
		expect(legend(scene, 12).map((t) => t.text)).toEqual([
			"11 different contents, all one colour",
		]);
		expect(swatches(scene, 12).map((s) => s.fill)).toEqual([PALETTE[0]]);
		expect(wells(scene, 12).map((w) => w.fill)).toEqual([
			...Array(11).fill(PALETTE[0]),
			EMPTY,
		]);
	});

	test("draws an empty well light grey, and a plate with nothing in it with no legend", () => {
		const scene = lay({ rows: 3, columns: 4 });
		const drawn = wells(scene, 12);
		expect(drawn.every((w) => w.fill === EMPTY && w.stroke === RULE)).toBe(
			true,
		);
		expect(discs(scene)).toHaveLength(12);
		expect(legend(scene, 12)).toEqual([]);
	});

	test("names the rows A to Z, then AA on, each right-aligned left of its row", () => {
		const scene = lay(sparse);
		const [first] = wells(scene, 32 * 48);
		const rows = texts(scene).filter((t) => t.x < first.x && t.y > first.y);
		const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
		expect(rows.map((t) => t.text)).toEqual([
			...letters,
			...["AA", "AB", "AC", "AD", "AE", "AF"],
		]);
		const ends = rows.map((t) => across(t)[1]);
		for (const end of ends) expect(end).toBeCloseTo(ends[0]);
		expect(ends[0]).toBeLessThan(first.x);
		expect(inside(scene)).toBe(true);
	});

	test("shrinks the wells of a wide plate, not the page or its title", () => {
		// mbio's wells: 21.32 across on 12 columns, 17.06 on 24 and 8.70 on 48.
		const twelve = lay({ title: "96", rows: 8, columns: 12 });
		const wide = lay({ title: "384", rows: 16, columns: 24 });
		const widest = lay(sparse);
		expect(wells(twelve, 1)[0].width).toBeCloseTo(21.32);
		expect(wells(wide, 1)[0].width).toBeCloseTo(17.06);
		expect(wells(widest, 1)[0].width).toBeCloseTo(8.7);
		expect(twelve.extent.width).toBeCloseTo(358);
		expect(wide.extent.width).toBeCloseTo(540);
		expect(lay({ rows: 1, columns: 96 }).extent.width).toBeCloseTo(540);
		for (const scene of [twelve, wide, widest]) {
			const title = texts(scene).filter((t) => t.face === "sans-bold");
			expect(title.map((t) => t.size)).toEqual([13]);
		}
	});

	test("is at least 240 wide, and wraps a long title inside it", () => {
		const scene = lay(oneWell);
		expect(scene.extent.width).toBe(240);
		const title = texts(scene).filter((t) => t.face === "sans-bold");
		expect(title.length).toBeGreaterThan(1);
		expect(title.map((t) => t.text).join(" ")).toBe(oneWell.title);
		expect(inside(scene)).toBe(true);
	});

	test("wraps a long legend entry past its swatch, and a word too long by its letters", () => {
		const scene = lay(longLegend);
		expect(inside(scene)).toBe(true);
		const lines = legend(scene, 8);
		// Every line of every entry starts at one x, past the swatches.
		expect(new Set(lines.map((t) => t.x)).size).toBe(1);
		const marks = swatches(scene, 8);
		expect(marks).toHaveLength(5);
		for (const mark of marks)
			expect(mark.x + mark.width).toBeLessThan(lines[0].x);
		// Each entry's lines are those from its swatch down to the next swatch.
		const entries = marks.map((mark, i) => {
			const next = marks[i + 1]?.y ?? Number.POSITIVE_INFINITY;
			return lines.filter((t) => t.y > mark.y && t.y < next).map((t) => t.text);
		});
		const said = Object.values(longLegend.wells);
		expect(entries.map((e) => e.join(" ").replaceAll(" ", ""))).toEqual(
			said.map((s) => s.replaceAll(" ", "")),
		);
		expect(entries[2].length).toBeGreaterThan(1);
		expect(entries[4].length).toBeGreaterThan(1);
		expect(entries[4][0]).not.toContain(" ");
	});
});
