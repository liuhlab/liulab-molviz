import { describe, expect, test } from "vitest";
import type { FormatError } from "../../src/viewer/format";
import {
	checkPlate,
	layoutPlate,
	rowLabel,
	wellAt,
	wellName,
} from "../../src/viewer/plate";
import { leftEdge, type Scene, type Shape } from "../../src/viewer/scene";
import { measure } from "../../src/viewer/text";
import eleven from "../plates/eleven-contents.json";
import longLegend from "../plates/long-legend.json";
import oneWell from "../plates/one-well.json";
import sparse from "../plates/sparse-1536.json";
import ten from "../plates/ten-contents.json";

const good = {
	title: "picked 1",
	rows: 16,
	columns: 24,
	wells: {
		A1: "quarter 1",
		A3: "quarter 1",
		C1: "quarter 2",
		P24: "quarter 4",
	},
};

describe("checkPlate", () => {
	test("returns a good plate as it is given", () => {
		expect(checkPlate(good)).toStrictEqual(good);
	});

	test.each<[string, object]>([
		["with no title", { rows: 8, columns: 12, wells: { H12: "water" } }],
		["with no wells", { title: "lysate 1", rows: 32, columns: 48 }],
		["with an empty title", { title: "", rows: 8, columns: 12 }],
		["of 1 row by 1 column", { rows: 1, columns: 1, wells: { A1: "tube" } }],
		["with rows past Z", { rows: 27, columns: 1, wells: { AA1: "last" } }],
		["with no well filled", { rows: 8, columns: 12, wells: {} }],
	])("takes a plate %s", (_, plate) => {
		expect(checkPlate(plate)).toStrictEqual(plate);
	});

	test.each<[string, unknown, string[]]>([
		["a plate that is not an object", null, ["plate: must be an object"]],
		[
			"a plate with no rows and no columns",
			{},
			["rows: missing", "columns: missing"],
		],
		[
			"rows and columns of 0, part of one, or not a number",
			{ rows: 0, columns: 1.5 },
			["rows: must be 1 or more", "columns: must be an integer"],
		],
		[
			"columns written as text",
			{ rows: 8, columns: "12" },
			["columns: must be a number"],
		],
		[
			"a title that is not text",
			{ ...good, title: 7 },
			["title: must be text"],
		],
		[
			"wells that are not an object",
			{ ...good, wells: "quarter 1" },
			["wells: must be an object"],
		],
		[
			"wells that are an empty list",
			{ ...good, wells: [] },
			["wells: must be an object"],
		],
		[
			"wells that are a list",
			{ ...good, wells: ["x"] },
			["wells: must be an object"],
		],
		[
			"a well whose contents are empty, blank or not text",
			{ ...good, wells: { A1: "", A2: ["forward 1"], A3: " " } },
			[
				"wells.A1: must not be blank",
				"wells.A2: must be text",
				"wells.A3: must not be blank",
			],
		],
		[
			"a well past the last row or the last column",
			{ ...good, wells: { Q1: "x", A25: "x", P24: "x" } },
			[
				"wells.Q1: not on the plate, which runs A1 to P24",
				"wells.A25: not on the plate, which runs A1 to P24",
			],
		],
		[
			"a name that is not a well's",
			{ ...good, wells: { A01: "x", b3: "x", reservoir: "x" } },
			[
				"wells.A01: not a well name, such as B3",
				"wells.b3: not a well name, such as B3",
				"wells.reservoir: not a well name, such as B3",
			],
		],
		[
			"a key the format does not have, __proto__ included",
			JSON.parse(
				'{"rows": 1, "columns": 1, "__proto__": 1, "wells": {"__proto__": "x"}}',
			),
			[
				"wells.__proto__: not a well name, such as B3",
				"__proto__: unknown key",
			],
		],
		[
			"a well name with rows or columns broken",
			{ rows: 0, columns: 12, wells: { Q1: "x", A01: "x" } },
			["rows: must be 1 or more", "wells.A01: not a well name, such as B3"],
		],
		[
			"a plate in mbio's own keys",
			{ name: "picked 1", wells: 384, labels: { A1: "quarter 1" } },
			[
				"rows: missing",
				"columns: missing",
				"wells: must be an object",
				"name: unknown key",
				"labels: unknown key",
			],
		],
	])("rejects %s", (_, input, expected) => {
		expect(problems(input)).toEqual(expected);
	});
});

/** The lines of the error checking `input` throws, or none. */
function problems(input: unknown): string[] {
	try {
		checkPlate(input);
		return [];
	} catch (error) {
		return (error as FormatError).message.split("\n");
	}
}

describe("well names", () => {
	test.each<[string, number, number]>([
		["A1", 0, 0],
		["B3", 1, 2],
		["Z12", 25, 11],
		["AA1", 26, 0],
		["AF48", 31, 47],
		["ZZ1", 701, 0],
		["AAA1", 702, 0],
	])("%s is row %i and column %i, counted from 0", (name, row, column) => {
		expect(wellAt(name)).toStrictEqual({ row, column });
		expect(wellName({ row, column })).toBe(name);
	});

	test.each(["a1", "A01", "A0", "1A", "A", "B 3", "reservoir", ""])(
		"%j names no well",
		(name) => {
			expect(wellAt(name)).toBeUndefined();
		},
	);

	test("a row's letters run A to Z, then AA on", () => {
		expect([0, 25, 26, 51, 52].map(rowLabel)).toEqual([
			"A",
			"Z",
			"AA",
			"AZ",
			"BA",
		]);
	});
});

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

/** Where `t` starts and ends, side to side. */
function edges(t: Text): [number, number] {
	const width = measure(t.text, t.face, t.size);
	const left = leftEdge(t, width);
	return [left, left + width];
}

/** Every text and disc of `scene` lies inside its margins, side to side. */
function inside(scene: Scene): boolean {
	const right = scene.extent.width - MARGIN;
	const spans = [
		...texts(scene).map(edges),
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
		const ends = rows.map((t) => edges(t)[1]);
		for (const end of ends) expect(end).toBeCloseTo(ends[0]);
		expect(ends[0]).toBeLessThan(first.x);
		expect(inside(scene)).toBe(true);
	});

	test("shrinks the wells of a wide plate, not the page or its title", () => {
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

	test("numbers column 1 and every other column of a plate too wide to number each", () => {
		const scene = lay({ rows: 1, columns: 150 });
		const [first] = wells(scene, 150);
		const numbers = texts(scene)
			.filter((t) => t.y < first.y)
			.sort((a, b) => a.x - b.x);
		const evens = Array.from({ length: 75 }, (_, i) => String(2 * (i + 1)));
		expect(numbers.map((t) => t.text)).toEqual(["1", ...evens]);
		const spans = numbers.map(edges);
		for (const [i, [, right]] of spans.slice(0, -1).entries()) {
			expect(right).toBeLessThanOrEqual(spans[i + 1][0]);
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
