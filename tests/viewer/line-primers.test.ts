import { describe, expect, test } from "vitest";
import { layout } from "../../src/viewer/line";
import { checkOptions } from "../../src/viewer/options";
import { check } from "../../src/viewer/record";
import type { Scene, Shape } from "../../src/viewer/scene";

/** 1000 bases: drawn 720 points long, each base is 0.72 points. */
const BASES = "ACGT".repeat(250);

const PRIMER = "#aa3377";

type Site = [start: number, end: number, strand: number];

function lay(
	record: { primers?: [string, ...Site[]][]; [key: string]: unknown },
	options: object = {},
): Scene {
	const { primers = [], ...rest } = record;
	const checked = check({
		name: "test",
		circular: false,
		bases: BASES,
		primers: primers.map(([name, ...sites]) => ({
			name,
			bases: "A".repeat(Math.max(...sites.map(([start, end]) => end - start))),
			sites: sites.map(([start, end, strand]) => ({ start, end, strand })),
		})),
		...rest,
	});
	return layout(checked, checkOptions(options, checked));
}

type Polygon = Extract<Shape, { shape: "polygon" }>;

function arrows(scene: Scene): Polygon[] {
	return scene.shapes
		.filter((s): s is Polygon => s.shape === "polygon" && s.fill === PRIMER)
		.sort((a, b) => xs(a)[0] - xs(b)[0]);
}

function xs(p: Polygon): [number, number] {
	const all = p.points.map(([x]) => x);
	return [Math.min(...all), Math.max(...all)];
}

function ys(p: Polygon): [number, number] {
	const all = p.points.map(([, y]) => y);
	return [Math.min(...all), Math.max(...all)];
}

/** The x of each point level with the arrow's middle, where a head's tip is. */
function tips(p: Polygon): number[] {
	const [top, bottom] = ys(p);
	return p.points
		.filter(([, y]) => Math.abs(y - (top + bottom) / 2) < 1e-9)
		.map(([x]) => x)
		.sort((a, b) => a - b);
}

type Line = Extract<Shape, { shape: "line" }>;

function lines(scene: Scene, stroke: string): Line[] {
	return scene.shapes.filter(
		(s): s is Line => s.shape === "line" && s.stroke === stroke,
	);
}

type Text = Extract<Shape, { shape: "text" }>;

/** The labels' text, which is the only text at their size. */
function texts(scene: Scene): Text[] {
	return scene.shapes.filter(
		(s): s is Text => s.shape === "text" && s.size === 11.5,
	);
}

// The heights are mbio's.
describe("a primer", () => {
	test("draws a thin arrow above the backbone at each site, its head at the 3' end", () => {
		const scene = lay({
			primers: [
				["fwd", [100, 200, 1]],
				["rev", [300, 400, -1]],
			],
		});
		const [fwd, rev] = arrows(scene);
		expect(arrows(scene)).toHaveLength(2);
		expect([xs(fwd), tips(fwd)]).toEqual([[72, 144], [144]]);
		expect([xs(rev), tips(rev)]).toEqual([[216, 288], [216]]);
		for (const arrow of [fwd, rev]) {
			const [top, bottom] = ys(arrow);
			expect(top).toBeCloseTo(-9.43, 2);
			expect(bottom).toBeCloseTo(-3.3, 2);
		}
	});

	test("takes the first row its site fits by start, a row 8.13 points above the last", () => {
		const scene = lay({
			primers: [
				["a", [100, 200, 1]],
				["b", [150, 250, 1]],
				["c", [204, 300, 1]],
				["d", [120, 160, -1]],
			],
		});
		const middle = (p: Polygon) => (ys(p)[0] + ys(p)[1]) / 2;
		// `c` starts less than three points past `a`'s end, so it goes up to `d`'s row.
		const [a, d, b, c] = arrows(scene);
		expect(middle(a)).toBeCloseTo(-6.37, 2);
		expect(middle(d)).toBeCloseTo(-14.5, 2);
		expect(middle(b)).toBeCloseTo(-22.63, 2);
		expect(middle(c)).toBeCloseTo(-14.5, 2);
	});

	test("is labelled by name and bases, unboxed in its colour, on a leader from its arrow's top", () => {
		const scene = lay({
			primers: [
				["a", [100, 200, 1]],
				["b", [150, 250, -1]],
			],
		});
		expect(scene.shapes.filter((s) => s.shape === "rect")).toEqual([]);
		const said = texts(scene).map(({ text, fill, anchor }) => ({
			text,
			fill,
			anchor,
		}));
		expect(said).toEqual(
			expect.arrayContaining([
				{ text: "a (101 .. 200)", fill: PRIMER, anchor: "start" },
				{ text: "b (151 .. 250)", fill: PRIMER, anchor: "start" },
			]),
		);
		expect(said).toHaveLength(2);
		const leaders = lines(scene, "#7f7f7f").sort((p, q) => p.x1 - q.x1);
		expect(leaders.map((l) => [l.x1, l.x2])).toEqual([
			[108, 108],
			[144, 144],
		]);
		expect(leaders[0].y1).toBeCloseTo(-9.43, 2);
		expect(leaders[1].y1).toBeCloseTo(-17.57, 2);
		// Every label clears the highest row by the room left above a drawing.
		for (const leader of leaders) {
			expect(leader.y2).toBeLessThanOrEqual(leaders[1].y1 - 10 + 1e-9);
		}
	});

	test("across the origin of a circle drawn whole lies at both ends, its bases read across it", () => {
		const scene = lay({
			circular: true,
			primers: [["p", [990, 1010, 1]]],
		});
		const [after, before] = arrows(scene);
		expect([xs(after), tips(after)]).toEqual([[0, 7.2], [7.2]]);
		expect([xs(before), tips(before)]).toEqual([[712.8, 720], []]);
		expect(texts(scene).map((t) => t.text)).toEqual([
			"p (991 .. 10)",
			"p (991 .. 10)",
		]);
	});
});

const INSERTION = "#cc3311";

describe("an insertion", () => {
	test("draws a bar across both strands, labelled with what it adds, in its colour", () => {
		const scene = lay({
			insertions: [
				{ name: "barcode", at: 450, length: 20, color: "#FF8800" },
				{ name: "spacer", at: 100, length: 3 },
			],
		});
		const bars = [...lines(scene, "#ff8800"), ...lines(scene, INSERTION)].map(
			({ x1, x2, y1, y2, strokeWidth }) => ({
				x1,
				x2,
				y1,
				y2,
				strokeWidth,
			}),
		);
		// mbio's: 1.5 points past the backbone either side, 2 points thick.
		expect(bars).toEqual([
			{ x1: 324, x2: 324, y1: -2.8, y2: 6.6, strokeWidth: 2 },
			{ x1: 72, x2: 72, y1: -2.8, y2: 6.6, strokeWidth: 2 },
		]);
		const said = texts(scene).map(({ text, fill }) => ({ text, fill }));
		expect(said).toEqual(
			expect.arrayContaining([
				{ text: "+20 bp", fill: "#ff8800" },
				{ text: "+3 bp", fill: INSERTION },
			]),
		);
		expect(said).toHaveLength(2);
		const leaders = lines(scene, "#7f7f7f").sort((p, q) => p.x1 - q.x1);
		expect(leaders.map(({ x1, y1 }) => [x1, y1])).toEqual([
			[72, -1.3],
			[324, -1.3],
		]);
	});

	// GenBank's `before^after`, as mbio's `point_text` writes it.
	test.each<[string, object, number, string, number[], string]>([
		["inside a linear record", {}, 450, "ins", [324], "ins · 450^451"],
		["before a linear record's first base", {}, 0, "ins", [0], "ins · 0^1"],
		["after its last", {}, 1000, "ins", [720], "ins · 1000^1001"],
		[
			"at a circle's origin, at the end of the circle opened whole",
			{ circular: true },
			0,
			"ins",
			[720],
			"ins · 1000^1",
		],
		[
			"a turn on, in a span across the origin",
			{ circular: true, options: { span: { start: 900, end: 1100 } } },
			50,
			"ins",
			[540],
			"ins · 50^51",
		],
		["with no name", {}, 450, " ", [324], "450^451"],
	])("%s gives its point on hover", (_, given, at, name, xs, hover) => {
		const { options, ...record } = given as { options?: object };
		const scene = lay(
			{ ...record, insertions: [{ name, at, length: 3 }] },
			options,
		);
		const bars = lines(scene, INSERTION);
		expect(bars.map((bar) => [bar.x1, bar.hover])).toEqual(
			xs.map((x) => [x, hover]),
		);
	});

	test("at the line's start, takes its bar's width into the extent", () => {
		const scene = lay({ insertions: [{ name: "ins", at: 0, length: 3 }] });
		// mbio's: half the bar's 2 points, then the 16-point margin.
		expect(scene.extent.x).toBeCloseTo(-17, 9);
	});

	test("labelled at a cut site's point, sets its label under the site's", () => {
		const scene = lay({
			insertions: [{ name: "ins", at: 500, length: 8 }],
			cuts: [{ enzyme: "EcoRI", start: 500, end: 506, at: 500, stagger: 0 }],
		});
		const [cut, insertion] = ["EcoRI", "+8 bp"].map(
			(text) => texts(scene).filter((t) => t.text === text)[0].y,
		);
		// The insertion's label sits a row under the site's, as on mbio's line.
		expect(insertion - cut).toBeCloseTo(17.39, 2);
	});
});

describe("kinds_off", () => {
	test("leaves out every primer and insertion, and their labels, when they are off", () => {
		const record = {
			primers: [["p", [100, 200, 1]]] as [string, Site][],
			insertions: [{ name: "ins", at: 450, length: 3 }],
		};
		const on = lay(record);
		expect([arrows(on).length, lines(on, INSERTION).length]).toEqual([1, 1]);
		const off = lay(record, { kinds_off: ["primers", "insertions"] });
		expect([arrows(off), lines(off, INSERTION), texts(off)]).toEqual([
			[],
			[],
			[],
		]);
		expect(lines(off, "#7f7f7f")).toEqual([]);
	});
});
