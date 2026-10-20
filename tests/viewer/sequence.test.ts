import { describe, expect, test } from "vitest";
import { checkOptions } from "../../src/viewer/options";
import { check } from "../../src/viewer/record";
import type { Shape } from "../../src/viewer/scene";
import { layoutSequence, type SequenceScene } from "../../src/viewer/sequence";
import { measure } from "../../src/viewer/text";
import {
	crossing,
	enzymesOf,
	onTheDrawing,
	overlapping,
	RECORDS,
} from "./apart";

/** 25 bases on a linear record, unless `record` says otherwise. */
const BASES = "ACGTACGTACGTACGTACGTACGTA";

function lay(options: object = {}, record: object = {}): SequenceScene {
	const checked = check({
		name: "test",
		circular: false,
		bases: BASES,
		...record,
	});
	return layoutSequence(
		checked,
		checkOptions({ sequence_view: true, ...options }, checked),
	);
}

type Text = Extract<Shape, { shape: "text" }>;

/** The texts set in `face`, top to bottom, then left to right. */
function texts(scene: SequenceScene, face: Text["face"]): Text[] {
	return scene.shapes
		.filter((s): s is Text => s.shape === "text" && s.face === face)
		.sort((a, b) => a.y - b.y || a.x - b.x);
}

describe("rows", () => {
	test("hold the span's bases in cells from its start, each with its last position flush right", () => {
		const scene = lay({
			span: { start: 3, end: 25 },
			bases_per_row: 10,
			bottom_strand: false,
		});
		const strands = texts(scene, "mono");
		expect(strands.map((t) => [t.text, t.cell, t.x])).toEqual([
			["TACGTACGTA", 11, 0],
			["CGTACGTACG", 11, 0],
			["TA", 11, 0],
		]);
		const last = texts(scene, "sans").filter((t) => t.x > 110);
		expect(last.map((t) => t.text)).toEqual(["13", "23", "25"]);
		const right = 110 + 14 + measure("13", "sans", 10.5);
		for (const t of last) {
			expect(t.x + measure(t.text, "sans", 10.5)).toBeCloseTo(right, 9);
		}
		expect(scene.rows).toHaveLength(3);
	});

	test("stack 16 apart, each as tall as the labels it sets above itself", () => {
		const scene = lay(
			{ bases_per_row: 10 },
			{
				features: features([
					{ name: "one name", segments: [[15, 16]] },
					{ name: "another", segments: [[17, 18]] },
				]),
			},
		);
		const [first, second, third] = scene.rows;
		expect(second.y).toBe(first.y + first.height + 16);
		expect(third.y).toBe(second.y + second.height + 16);
		expect(second.height).toBeGreaterThan(first.height + 30);
		const boxes = scene.shapes.filter((s) => s.shape === "rect");
		expect(boxes).toHaveLength(2);
		for (const box of boxes) expect(box.y).toBeGreaterThanOrEqual(second.y);
		const left = Math.min(...scene.rows.map((row) => row.x));
		const right = Math.max(...scene.rows.map((row) => row.x + row.width));
		expect(scene.extent).toEqual({
			x: left - 16,
			y: -16,
			width: right - left + 32,
			height: third.y + third.height + 32,
		});
	});

	test("number each base the record numbers a multiple of ten over its middle, on past the origin", () => {
		const scene = lay(
			{ span: { start: 12, end: 37 }, bases_per_row: 25 },
			{ circular: true },
		);
		const numbers = texts(scene, "sans").filter((t) => t.x < 275);
		expect(numbers.map((t) => [t.text, t.x, t.anchor])).toEqual([
			["20", 82.5, "middle"],
			["10", 247.5, "middle"],
		]);
		expect(texts(scene, "sans").at(-1)?.text).toBe("12");
	});

	test("set the bottom strand under the top as its complement, in the record's case, U as A", () => {
		const bases = "ACGTURYSWKMBDHVNacgtu";
		const scene = lay({}, { bases });
		expect(texts(scene, "mono").map((t) => t.text)).toEqual([
			bases,
			"TGCAAYRSWMKVHDBNtgcaa",
		]);
	});

	test("are as tall as mbio's, and a strand shorter without the bottom one", () => {
		const both = lay().rows[0].height;
		expect(both).toBeCloseTo(50.83, 2);
		const one = lay({ bottom_strand: false });
		expect(texts(one, "mono")).toHaveLength(1);
		expect(one.rows[0].height).toBeLessThan(both - 12);
	});

	test("tick every base on the rail in one path, longer at each fifth and tenth", () => {
		const scene = lay({ span: { start: 3, end: 15 } });
		const rails = scene.shapes.filter(
			(s): s is Extract<Shape, { shape: "line" }> => s.shape === "line",
		);
		expect(rails).toHaveLength(1);
		const [rail] = rails;
		expect([rail.x1, rail.x2, rail.y1, rail.y2]).toEqual([
			0,
			132,
			rail.y1,
			rail.y1,
		]);
		expect(rail.y1).toBeCloseTo(32.53, 2);
		expect([rail.stroke, rail.strokeWidth]).toEqual(["#7f7f7f", 1.6]);
		const paths = scene.shapes.filter(
			(s): s is Extract<Shape, { shape: "path" }> => s.shape === "path",
		);
		expect(paths).toHaveLength(1);
		const reaches = [
			1.5, 2.5, 1.5, 1.5, 1.5, 1.5, 3.5, 1.5, 1.5, 1.5, 1.5, 2.5,
		];
		expect(paths[0]).toEqual({
			shape: "path",
			commands: reaches.flatMap((reach, i) => [
				["M", (i + 0.5) * 11, rail.y1 - reach],
				["L", (i + 0.5) * 11, rail.y1 + reach],
			]),
			fill: "none",
			stroke: "#7f7f7f",
			strokeWidth: 1,
		});
	});
});

interface Made {
	name?: string;
	type?: string;
	strand?: number;
	segments: [number, number][];
	color?: string;
}

/** `made` as a record's features, nameless `misc_feature`s on the forward strand by default. */
function features(made: Made[]): object[] {
	return made.map(({ segments, ...rest }) => ({
		name: "",
		type: "misc_feature",
		strand: 1,
		...rest,
		segments: segments.map(([start, end]) => ({ start, end })),
	}));
}

type Polygon = Extract<Shape, { shape: "polygon" }>;

/** The arrows filled `color`, top to bottom, then left to right. */
function arrows(scene: SequenceScene, color: string): Polygon[] {
	return scene.shapes
		.filter((s): s is Polygon => s.shape === "polygon" && s.fill === color)
		.sort((a, b) => middle(a) - middle(b) || left(a) - left(b));
}

function left(p: Polygon): number {
	return Math.min(...p.points.map(([x]) => x));
}

function middle(p: Polygon): number {
	const ys = p.points.map(([, y]) => y);
	return (Math.min(...ys) + Math.max(...ys)) / 2;
}

/** `p`'s points, each from its middle's height. */
function shape(p: Polygon): [number, number][] {
	return p.points.map(([x, y]) => [x, y - middle(p)]);
}

describe("feature bars", () => {
	test("lie under the bases in each row a feature reaches, a zigzag edge where a row cuts one", () => {
		const scene = lay(
			{ bases_per_row: 10 },
			{ features: features([{ segments: [[5, 25]], color: "#000001" }]) },
		);
		const [first, second, third] = arrows(scene, "#000001");
		const zigzagEnd = (x: number) => [
			[x - 4, -3.75],
			[x, 0],
			[x - 4, 3.75],
		];
		const zigzagStart = [
			[4, 3.75],
			[0, 0],
			[4, -3.75],
		];
		expect(shape(first)).toEqual([
			[55, -7.5],
			[110, -7.5],
			...zigzagEnd(110),
			[110, 7.5],
			[55, 7.5],
		]);
		expect(shape(second)).toEqual([
			[0, -7.5],
			[110, -7.5],
			...zigzagEnd(110),
			[110, 7.5],
			[0, 7.5],
			...zigzagStart,
		]);
		expect(shape(third)).toEqual([
			[0, -7.5],
			[43, -7.5],
			[43, -11.5],
			[55, 0],
			[43, 11.5],
			[43, 7.5],
			[0, 7.5],
			...zigzagStart,
		]);
		const strandsBottom = scene.rows[0].y + 50.83;
		expect(middle(first) - 11.5).toBeGreaterThan(strandsBottom);
	});

	test("keep a flat edge where a row cuts a bar its head fills", () => {
		const scene = lay(
			{ bases_per_row: 10 },
			{ features: features([{ segments: [[5, 11]], color: "#000001" }]) },
		);
		const [, last] = arrows(scene, "#000001");
		expect(shape(last)).toEqual([
			[0, -7.5],
			[0, -7.5],
			[0, -11.5],
			[11, 0],
			[0, 11.5],
			[0, 7.5],
			[0, 7.5],
		]);
	});

	test("draw a line across a join's gap, in a row the gap alone crosses too", () => {
		const scene = lay(
			{ bases_per_row: 10 },
			{
				bases: "ACGT".repeat(10),
				features: features([
					{
						segments: [
							[2, 5],
							[25, 28],
						],
						color: "#000001",
					},
				]),
			},
		);
		const gaps = scene.shapes.filter(
			(s): s is Extract<Shape, { shape: "line" }> =>
				s.shape === "line" && s.stroke === "#666666",
		);
		expect(gaps.map((g) => [g.x1, g.x2])).toEqual([
			[55, 110],
			[0, 110],
			[0, 55],
		]);
		const [first, last] = arrows(scene, "#000001");
		expect(gaps[0].y1).toBe(middle(first));
		expect(gaps[2].y1).toBe(middle(last));
		expect(gaps[1].y1 - gaps[0].y1).toBeCloseTo(
			scene.rows[1].y - scene.rows[0].y,
			9,
		);
	});

	test("join a piece to a linear record's end in its row, and the start to the next", () => {
		const scene = lay(
			{ bases_per_row: 10 },
			{
				bases: "ACGT".repeat(10),
				features: features([
					{
						segments: [
							[33, 37],
							[2, 5],
						],
						color: "#000001",
					},
				]),
			},
		);
		const joins = scene.shapes.filter(
			(s): s is Extract<Shape, { shape: "line" }> =>
				s.shape === "line" && s.stroke === "#666666",
		);
		expect(joins.map((g) => [g.x1, g.x2])).toEqual([
			[0, 22],
			[77, 110],
		]);
		const [after, before] = arrows(scene, "#000001");
		expect([left(after), left(before)]).toEqual([22, 33]);
		expect(joins[0].y1).toBe(middle(after));
		expect(joins[1].y1).toBe(middle(before));
		expect(middle(before)).toBeGreaterThan(scene.rows[3].y);
	});
});

describe("feature names", () => {
	test("go inside a bar, under it within the row, or in a box above the row", () => {
		// The promoter shares lacZ's tier, where its name would meet lacZ; the operator has a
		// tier to itself.
		const scene = lay(
			{ bases_per_row: 20 },
			{
				features: features([
					{ name: "lacZ", segments: [[4, 16]] },
					{ name: "lac promoter", segments: [[0, 1]] },
					{ name: "operator", segments: [[0, 1]] },
				]),
			},
		);
		const [inside, under, boxed, ten] = [
			"lacZ",
			"operator",
			"lac promoter",
			"10",
		].map((text) => texts(scene, "sans").filter((t) => t.text === text)[0]);
		expect(inside.x).toBe((44 + 176 - 12) / 2);
		expect(under.x - measure("operator", "sans", 11.5) / 2).toBe(0);
		expect(boxed.y).toBeLessThan(ten.y);
		expect(scene.shapes.filter((s) => s.shape === "rect")).toHaveLength(1);
	});

	test("keep clear of a zigzag edge's teeth inside a bar, else go under it", () => {
		// The row cuts the bar's end at 110, its teeth 4 deep; a name keeps 3 from either side.
		const wide = (name: string) => measure(name, "sans", 11.5);
		let fits = "";
		while (wide(`${fits}i`) + 6 <= 106) fits += "i";
		const tight = `${fits}i`;
		expect(wide(tight) + 6).toBeLessThanOrEqual(110);
		const scene = lay(
			{ bases_per_row: 10 },
			{
				bases: "ACGT".repeat(10),
				features: features([
					{ name: fits, strand: 0, segments: [[0, 15]], color: "#00000a" },
					{ name: tight, strand: 0, segments: [[20, 35]], color: "#00000b" },
				]),
			},
		);
		const [inside] = texts(scene, "sans").filter((t) => t.text === fits);
		expect(inside.x).toBeCloseTo(106 / 2, 9);
		expect(inside.x + wide(fits) / 2 + 3).toBeLessThanOrEqual(106);
		const [under] = texts(scene, "sans").filter((t) => t.text === tight);
		const [bar] = arrows(scene, "#00000b");
		expect(under.y).toBeGreaterThan(Math.max(...bar.points.map(([, y]) => y)));
	});

	test("never hide, however many crowd into boxes", () => {
		const names = Array.from({ length: 60 }, (_, i) => `feature ${i}`);
		const made = names.map((name, i): Made => {
			const at = i % 2 ? 5 : 3;
			return { name, segments: [[at, at + 1]] };
		});
		const scene = lay({}, { features: features(made) });
		const shown = new Set(texts(scene, "sans").map((t) => t.text));
		expect(names.filter((name) => !shown.has(name))).toEqual([]);
		const boxes = scene.shapes.filter((s) => s.shape === "rect");
		expect(boxes).toHaveLength(60);
		for (const s of boxes) {
			expect(s.y).toBeGreaterThanOrEqual(scene.rows[0].y);
		}
	});
});

describe("feature tiers", () => {
	test("keep a bar running on into the next row in its tier among bars starting with it", () => {
		const scene = lay(
			{ bases_per_row: 10 },
			{
				features: features([
					{ segments: [[5, 25]], color: "#00000a" },
					{ segments: [[2, 25]], color: "#00000b" },
				]),
			},
		);
		const a = arrows(scene, "#00000a").map(middle);
		const b = arrows(scene, "#00000b").map(middle);
		for (const row of [0, 1, 2]) expect(b[row]).toBeLessThan(a[row]);
	});
});

describe("features", () => {
	test("leave out a type or the kind turned off, and dim what a highlight leaves unlit", () => {
		const record = {
			features: features([
				{ name: "lacZ", type: "CDS", segments: [[0, 9]], color: "#00000a" },
				{ name: "ori", segments: [[10, 19]], color: "#00000b" },
			]),
		};
		expect(arrows(lay({ types_off: ["CDS"] }, record), "#00000a")).toEqual([]);
		expect(
			lay({ kinds_off: ["features"] }, record).shapes.filter(
				(s) => s.shape === "polygon",
			),
		).toEqual([]);
		const lit = lay({ highlight: ["ori"] }, record);
		expect(arrows(lit, "#00000a")).toEqual([]);
		expect(arrows(lit, "#dddddd")).toHaveLength(1);
		expect(arrows(lit, "#00000b")).toHaveLength(1);
		expect(new Set(texts(lit, "mono").map((t) => t.fill))).toEqual(
			new Set(["#252525"]),
		);
	});
});

describe.each(RECORDS)("%s drawn whole", (_, file) => {
	describe.each([
		["the unique cutters", {}],
		["every enzyme", { enzymes: enzymesOf(file) }],
	])("with %s", (__, given) => {
		const record = check(file);
		const scene = layoutSequence(
			record,
			checkOptions({ sequence_view: true, ...given }, record),
		);

		test("no two labels overlap, and none overlaps the drawing", () => {
			expect(overlapping(scene)).toEqual([]);
			expect(onTheDrawing(scene)).toEqual([]);
		});

		test("no leader crosses another label", () => {
			expect(crossing(scene)).toEqual([]);
		});
	});
});
