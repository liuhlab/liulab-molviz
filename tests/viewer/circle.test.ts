import { describe, expect, test } from "vitest";
import { layoutCircle } from "../../src/viewer/circle";
import type { MapScene } from "../../src/viewer/labels";
import { checkOptions } from "../../src/viewer/options";
import { check } from "../../src/viewer/record";
import type { PathCommand, Scene, Shape } from "../../src/viewer/scene";
import { baseline, height, measure, metrics } from "../../src/viewer/text";
import ap1File from "../records/ap1-product.json";
import colourTestFile from "../records/colour-test.json";
import puc19File from "../records/puc19-gfp-product.json";

/** A circular record of 1000 bases: each base turns 0.36 degrees. */
const BASES = "ACGT".repeat(250);

interface Made {
	name?: string;
	type?: string;
	strand?: number;
	segments: [number, number][];
	color?: string;
}

function lay(
	features: Made[],
	{
		options = {},
		record = {},
		rotation,
		zoom,
	}: {
		options?: object;
		record?: object;
		rotation?: number;
		zoom?: number;
	} = {},
): MapScene {
	const checked = check({
		name: "test",
		circular: true,
		bases: BASES,
		features: features.map(({ segments, ...rest }) => ({
			name: "",
			type: "misc_feature",
			strand: 1,
			...rest,
			segments: segments.map(([start, end]) => ({ start, end })),
		})),
		...record,
	});
	return layoutCircle(checked, checkOptions(options, checked), rotation, zoom);
}

type Path = Extract<Shape, { shape: "path" }>;
type Line = Extract<Shape, { shape: "line" }>;
type Point = readonly [number, number];

function paths(scene: Scene): Path[] {
	return scene.shapes.filter((s): s is Path => s.shape === "path");
}

function lines(scene: Scene): Line[] {
	return scene.shapes.filter((s): s is Line => s.shape === "line");
}

/** Where each step of a path ends. */
function ends(commands: readonly PathCommand[]): Point[] {
	return commands.flatMap((c): Point[] => {
		if (c[0] === "Z") return [];
		return c[0] === "A" ? [[c[4], c[5]]] : [[c[1], c[2]]];
	});
}

/** The distances from the centre of a path's points, each to three decimals, without repeats. */
function radii(path: Path): number[] {
	const all = ends(path.commands).map(([x, y]) =>
		Number(Math.hypot(x, y).toFixed(3)),
	);
	return [...new Set(all)].sort((a, b) => a - b);
}

describe("the backbone", () => {
	test("is two circles 3.8 points apart, the origin's tick inside them at the top", () => {
		const scene = lay([]);
		const strands = paths(scene).filter(
			(p) => p.fill === "none" && p.strokeWidth === 2.6,
		);
		expect(strands.map(radii)).toEqual([[220], [216.2]]);
		const [tick] = lines(scene).filter((l) => l.strokeWidth === 2.4);
		expect(tick.x1).toBe(0);
		expect(tick.x2).toBe(0);
		expect(tick.y1).toBeCloseTo(-214.9);
		expect(tick.y2).toBeCloseTo(-202.9);
	});
});

type Text = Extract<Shape, { shape: "text" }>;

function texts(scene: Scene): Text[] {
	return scene.shapes.filter((s): s is Text => s.shape === "text");
}

/** The angle of the point (`x`, `y`) about the centre, in degrees clockwise from the top. */
function degreesOf(x: number, y: number): number {
	const angle = (Math.atan2(x, -y) * 180) / Math.PI;
	return angle < 0 ? angle + 360 : angle;
}

describe("the ruler", () => {
	test("ticks each multiple of its step inside the backbone, its numbers turned to read upright", () => {
		const scene = lay([]);
		const ticks = lines(scene).filter((l) => l.strokeWidth === 1.2);
		expect(ticks.map((t) => degreesOf(t.x1, t.y1))).toEqual(
			[36, 72, 108, 144, 180, 216, 252, 288, 324].map((d) => expect.closeTo(d)),
		);
		for (const t of ticks) {
			expect(Math.hypot(t.x1, t.y1)).toBeCloseTo(214.9);
			expect(Math.hypot(t.x2, t.y2)).toBeCloseTo(208.9);
		}
		const numbers = texts(scene).filter((t) => t.rotate !== undefined);
		expect(numbers.map((n) => [n.text, n.rotate])).toEqual(
			[
				["100", 36],
				["200", 72],
				["300", -72],
				["400", -36],
				["500", 0],
				["600", 36],
				["700", 72],
				["800", -72],
				["900", -36],
			].map(([text, rotate]) => [text, expect.closeTo(Number(rotate))]),
		);
		for (const [i, n] of numbers.entries()) {
			expect(degreesOf(n.x, n.y)).toBeCloseTo(36 * (i + 1));
		}
	});

	test("leaves out a number too near the origin's tick, but not its tick", () => {
		const scene = lay([], { record: { bases: `${BASES}A` } });
		const ticks = lines(scene).filter((l) => l.strokeWidth === 1.2);
		expect(ticks).toHaveLength(5);
		const numbers = texts(scene).filter((t) => t.rotate !== undefined);
		expect(numbers.map((n) => n.text)).toEqual(["200", "400", "600", "800"]);
	});
});

describe("the centre", () => {
	test("holds the record's name in bold over its length, the pair centred on the centre", () => {
		const scene = lay([], { record: { name: "pTest" } });
		const [name, length] = texts(scene).filter((t) => t.rotate === undefined);
		expect([name.text, name.face, name.size]).toEqual([
			"pTest",
			"sans-bold",
			13.5,
		]);
		expect([length.text, length.face, length.size]).toEqual([
			"1000 bp",
			"sans",
			10.5,
		]);
		expect([name.x, length.x, name.anchor]).toEqual([0, 0, "middle"]);
		const top = name.y - metrics("sans-bold").ascent * 13.5;
		const bottom = length.y + metrics("sans").descent * 10.5;
		expect(top + bottom).toBeCloseTo(0);
	});

	test("holds the length alone for a record with no name", () => {
		const scene = lay([], { record: { name: " " } });
		const [length] = texts(scene).filter((t) => t.rotate === undefined);
		expect(length.text).toBe("1000 bp");
		expect(length.y).toBeCloseTo(baseline("sans", 10.5, 0));
	});
});

/** The middle of the outermost ring's band: the ruler's numbers, a head's reach and half a band in. */
const OUTER = 220 - 3.8 - 1.3 - 6 - 2 - height("sans", 10.5) - 4 - 7.5;

/** The arrows filled `color`. */
function arrows(scene: Scene, color: string): Path[] {
	return paths(scene).filter((p) => p.fill === color);
}

/** The angles, in degrees, of the points of `path` on the middle of its band, where a head's tip is. */
function tips(path: Path, middle = OUTER): number[] {
	return ends(path.commands)
		.filter(([x, y]) => Math.abs(Math.hypot(x, y) - middle) < 1e-9)
		.map(([x, y]) => Number(degreesOf(x, y).toFixed(6)))
		.sort((a, b) => a - b);
}

describe("arrows", () => {
	test.each([
		[1, [90]],
		[-1, [0]],
		[0, []],
		[2, [0, 90]],
	])(
		"on strand %i have their heads' tips at %j degrees",
		(strand, expected) => {
			const scene = lay([{ strand, segments: [[0, 250]], color: "#000001" }]);
			const [arrow] = arrows(scene, "#000001");
			expect(tips(arrow)).toEqual(expected);
			const band = [OUTER - 7.5, OUTER + 7.5].map((r) => Number(r.toFixed(3)));
			const heads = [OUTER - 11.5, OUTER + 11.5].map((r) =>
				Number(r.toFixed(3)),
			);
			expect(radii(arrow)).toEqual(
				strand === 0
					? band
					: [heads[0], band[0], OUTER, band[1], heads[1]].map((r) =>
							Number(r.toFixed(3)),
						),
			);
		},
	);

	test("draw a segment across the origin as one arrow", () => {
		const scene = lay([{ segments: [[950, 1050]], color: "#000001" }]);
		const [arrow, ...more] = arrows(scene, "#000001");
		expect(more).toEqual([]);
		expect(tips(arrow)).toEqual([18]);
		const [x, y] = ends(arrow.commands)[0];
		expect(degreesOf(x, y)).toBeCloseTo(342);
	});

	test("of one feature are joined by a thin arc across the gap between them", () => {
		const scene = lay([
			{
				segments: [
					[100, 200],
					[300, 400],
				],
				color: "#000001",
			},
		]);
		const [join, ...more] = paths(scene).filter(
			(p) => p.fill === "none" && p.stroke === "#666666",
		);
		expect(more).toEqual([]);
		expect(join.strokeWidth).toBe(1.5);
		expect(radii(join)).toEqual([Number(OUTER.toFixed(3))]);
		const angles = ends(join.commands).map(([x, y]) => degreesOf(x, y));
		expect([angles[0], angles[angles.length - 1]]).toEqual([
			expect.closeTo(72),
			expect.closeTo(108),
		]);
	});
});

/** The middle of the band of an arrow with no heads. */
function middleOf(path: Path): number {
	const [inner, outer] = radii(path);
	return (inner + outer) / 2;
}

/** The least distance from the centre any point of `path` comes. */
function nearest(path: Path): number {
	return Math.min(...ends(path.commands).map(([x, y]) => Math.hypot(x, y)));
}

describe("rings", () => {
	test("hold overlapping features further in, the longest outermost, 3 points apart on the backbone", () => {
		const scene = lay([
			{ strand: 0, segments: [[100, 300]], color: "#000001" },
			{ strand: 0, segments: [[200, 600]], color: "#000002" },
			// 3 points on the backbone is 2.17 bases: 5 bases apart is far enough, 4 is not.
			{ strand: 0, segments: [[605, 700]], color: "#000003" },
			{ strand: 0, segments: [[604, 650]], color: "#000004" },
		]);
		const middles = ["#000001", "#000002", "#000003", "#000004"].map((c) =>
			middleOf(arrows(scene, c)[0]),
		);
		expect(middles).toEqual(
			[OUTER - 25, OUTER, OUTER, OUTER - 25].map((r) => expect.closeTo(r, 3)),
		);
	});

	test("count a feature across the origin as overlapping those just past it", () => {
		const scene = lay([
			{ strand: 0, segments: [[900, 1050]], color: "#000001" },
			{ strand: 0, segments: [[10, 40]], color: "#000002" },
			{ strand: 0, segments: [[100, 120]], color: "#000003" },
		]);
		const middles = ["#000001", "#000002", "#000003"].map((c) =>
			middleOf(arrows(scene, c)[0]),
		);
		expect(middles).toEqual(
			[OUTER, OUTER - 25, OUTER].map((r) => expect.closeTo(r, 3)),
		);
	});

	test("come closer together, their bands thinner, once they would pass 0.4 of the radius", () => {
		const made = Array.from({ length: 8 }, (_, i) => ({
			strand: 0,
			segments: [[0, 100 + 10 * i]] as [number, number][],
			color: `#00000${i + 1}`,
		}));
		const scene = lay(made);
		const step = (OUTER - 88) / 7;
		for (const [i, { color }] of made.entries()) {
			const [arrow] = arrows(scene, color);
			const [inner, outer] = radii(arrow);
			expect((inner + outer) / 2).toBeCloseTo(OUTER - (7 - i) * step, 3);
			expect(outer - inner).toBeCloseTo((15 * step) / 25, 2);
		}
	});

	test("keep clear of a long name in the centre", () => {
		const name = "pTEST-a-long-name-for-a-record";
		const scene = lay(
			Array.from({ length: 8 }, (_, i) => ({
				segments: [[0, 100 + 10 * i]] as [number, number][],
				color: `#00000${i + 1}`,
			})),
			{ record: { name } },
		);
		const tall = height("sans-bold", 13.5) + height("sans", 10.5);
		const corner = Math.hypot(measure(name, "sans-bold", 13.5) / 2, tall / 2);
		const innermost = Math.min(
			...paths(scene)
				.filter((p) => p.fill !== "none")
				.map(nearest),
		);
		expect(corner).toBeGreaterThan(88 - (0.46 * (OUTER - 88)) / 7);
		expect(innermost).toBeCloseTo(corner, 6);
	});
});

type Letters = Extract<Shape, { shape: "letters" }>;
type Rect = Extract<Shape, { shape: "rect" }>;

function letters(scene: Scene): Letters[] {
	return scene.shapes.filter((s): s is Letters => s.shape === "letters");
}

function rects(scene: Scene): Rect[] {
	return scene.shapes.filter((s): s is Rect => s.shape === "rect");
}

describe("a feature's name", () => {
	test("is set along its arrow when it fits, a letter at a time, past the head", () => {
		const scene = lay([
			{ name: "lacZ", segments: [[0, 250]], color: "#000000" },
		]);
		const [name, ...more] = letters(scene);
		expect(more).toEqual([]);
		expect([name.text, name.face, name.size, name.fill]).toEqual([
			"lacZ",
			"sans",
			11.5,
			"#ffffff",
		]);
		const turns = name.places.map(([, , rotate]) => rotate);
		expect(turns).toEqual([...turns].sort((a, b) => a - b));
		const head = (12 / OUTER) * (180 / Math.PI);
		expect(turns[0]).toBeGreaterThan(0);
		expect(turns[3]).toBeLessThan(90 - head);
		expect(rects(scene)).toEqual([]);
	});

	test("reads left to right on the lower half, turned half a turn", () => {
		const scene = lay([{ name: "bla", strand: 0, segments: [[400, 600]] }]);
		const [name] = letters(scene);
		const xs = name.places.map(([x]) => x);
		expect(xs).toEqual([...xs].sort((a, b) => a - b));
		for (const [, y, rotate] of name.places) {
			expect(y).toBeGreaterThan(0);
			expect(Math.abs(rotate)).toBeLessThan(10);
		}
	});

	test("fits when it and 3 points either side span no more than the band", () => {
		const text = "ABC";
		const room = measure(text, "sans", 11.5) + 6;
		const bases = (room / OUTER) * (1000 / (2 * Math.PI));
		const fits = lay([
			{ name: text, strand: 0, segments: [[100, 100 + Math.ceil(bases)]] },
		]);
		const boxed = lay([
			{ name: text, strand: 0, segments: [[100, 100 + Math.floor(bases)]] },
		]);
		expect(letters(fits).map((l) => l.text)).toEqual([text]);
		expect(letters(boxed)).toEqual([]);
	});

	test("goes in a box of its colour in a column, on a leader from the drawing, when it does not fit", () => {
		const scene = lay([
			{ name: "lacZ-alpha", segments: [[100, 110]], color: "#ffaabb" },
		]);
		expect(letters(scene)).toEqual([]);
		const [box] = rects(scene);
		expect([box.fill, box.stroke]).toEqual(["#ffaabb", "#734d54"]);
		const [label] = texts(scene).filter((t) => t.text === "lacZ-alpha");
		expect(label.x).toBeCloseTo(box.x + 3);
		const [leader] = lines(scene).filter((l) => l.stroke === "#7f7f7f");
		expect(leader.strokeWidth).toBe(0.8);
		expect(Math.hypot(leader.x1, leader.y1)).toBeCloseTo(220 + 1.3 + 4);
		expect(degreesOf(leader.x1, leader.y1)).toBeCloseTo(37.8);
		expect(leader.x2).toBeCloseTo(box.x);
		expect(Math.hypot(leader.x2, leader.y2)).toBeGreaterThan(221.3 + 14 - 1e-6);
	});

	test("goes in a column when the bands are too thin for its letters", () => {
		const made = Array.from({ length: 8 }, (_, i) => ({
			name: "f",
			strand: 0,
			segments: [[0, 400 + 10 * i]] as [number, number][],
		}));
		expect(letters(lay(made.slice(0, 1)))).toHaveLength(1);
		const scene = lay(made);
		expect(letters(scene)).toEqual([]);
		expect(rects(scene)).toHaveLength(8);
	});
});

/** `[x, y]` turned `degrees` clockwise about the centre. */
function turned([x, y]: Point, degrees: number): Point {
	const angle = (degrees * Math.PI) / 180;
	const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
	return [x * cos - y * sin, x * sin + y * cos];
}

describe("a turned circle", () => {
	test.each([30, 137.5, -90])(
		"draws at %f degrees the arcs it draws at 0, turned",
		(degrees) => {
			const record = check(colourTestFile);
			const options = checkOptions({}, record);
			const before = paths(layoutCircle(record, options));
			const after = paths(layoutCircle(record, options, degrees));
			expect(after.length).toBe(before.length);
			for (const [i, path] of after.entries()) {
				const was = before[i];
				expect([path.fill, path.stroke]).toEqual([was.fill, was.stroke]);
				expect(path.commands.map((c) => c[0])).toEqual(
					was.commands.map((c) => c[0]),
				);
				const expected = ends(was.commands).map((p) => turned(p, degrees));
				for (const [k, [x, y]] of ends(path.commands).entries()) {
					expect(x).toBeCloseTo(expected[k][0], 6);
					expect(y).toBeCloseTo(expected[k][1], 6);
				}
			}
		},
	);
});

/** Sixty features too short for their names, side by side about a quarter turn round. */
const CROWD: Made[] = Array.from({ length: 60 }, (_, i) => ({
	name: `feature-${i}`,
	segments: [[190 + 2 * i, 192 + 2 * i]],
}));

describe("a zoomed circle", () => {
	test("is larger, its bands as thick, and gives its labels more room above and below", () => {
		const scene = lay(CROWD.slice(0, 1), { zoom: 2 });
		const strands = paths(scene).filter(
			(p) => p.fill === "none" && p.strokeWidth === 2.6,
		);
		expect(strands.map(radii)).toEqual([[440], [436.2]]);
		const [arrow] = paths(scene).filter((p) => p.fill !== "none");
		const band = radii(arrow);
		expect(band[band.length - 1] - band[0]).toBeCloseTo(15 + 2 * 4, 2);
		expect(lay(CROWD).hidden.length).toBeGreaterThan(0);
		expect(lay(CROWD, { zoom: 2 }).hidden).toEqual([]);
	});
});

describe("the extent", () => {
	test("holds the drawing and every label, 16 points to spare", () => {
		const scene = lay([{ name: "lacZ-alpha", segments: [[245, 255]] }]);
		const [box] = rects(scene);
		const { x, y, width, height: tall } = scene.extent;
		expect(x).toBeCloseTo(-221.3 - 4 - 16);
		expect(y).toBeCloseTo(-221.3 - 4 - 16);
		expect(y + tall).toBeCloseTo(221.3 + 4 + 16);
		expect(x + width).toBeCloseTo(box.x + box.width + 16);
	});
});

describe("mbio's records", () => {
	test.each([
		["pUC19-GFP", puc19File, 5, 4],
		["AP-1", ap1File, 6, 0],
		["colour-test", colourTestFile, 4, 4],
	])(
		"%s takes as many rings and names on arrows as mbio draws",
		(_, file, rings, named) => {
			const record = check(file);
			const scene = layoutCircle(record, checkOptions({}, record));
			const middles = paths(scene)
				.filter((p) => p.fill !== "none")
				.map((p) => {
					const all = ends(p.commands).map(([x, y]) => Math.hypot(x, y));
					return ((Math.min(...all) + Math.max(...all)) / 2).toFixed(2);
				});
			expect(new Set(middles).size).toBe(rings);
			expect(letters(scene)).toHaveLength(named);
		},
	);
});
