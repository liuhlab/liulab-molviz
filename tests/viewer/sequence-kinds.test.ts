import { describe, expect, test } from "vitest";
import { checkOptions } from "../../src/viewer/options";
import { check } from "../../src/viewer/record";
import type { Shape } from "../../src/viewer/scene";
import { layoutSequence, type SequenceScene } from "../../src/viewer/sequence";
import { height, metrics } from "../../src/viewer/text";

/** 40 bases on a linear record, unless `record` says otherwise. */
const BASES = "ACGT".repeat(10);

const PRIMER = "#aa3377";
const INK = "#252525";

function lay(record: object = {}, options: object = {}): SequenceScene {
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

interface Site {
	start: number;
	end: number;
	strand: number;
	mismatches?: number[];
}

/** A primer named `name` binding at `sites`, `tail` bases longer than its longest site. */
function primer(name: string, sites: Site[], tail = 0): object {
	const longest = Math.max(...sites.map(({ start, end }) => end - start));
	return { name, bases: "A".repeat(longest + tail), sites };
}

/** A cut by `enzyme` of the recognition span `start` to `end`. */
function cut(
	enzyme: string,
	start: number,
	end: number,
	at: number,
	stagger: number,
) {
	return { enzyme, start, end, at, stagger };
}

type Polygon = Extract<Shape, { shape: "polygon" }>;
type Text = Extract<Shape, { shape: "text" }>;
type Line = Extract<Shape, { shape: "line" }>;
type Path = Extract<Shape, { shape: "path" }>;
type Rect = Extract<Shape, { shape: "rect" }>;

/** The polygons filled `fill`, top to bottom, then left to right. */
function polygons(scene: SequenceScene, fill: string): Polygon[] {
	return scene.shapes
		.filter((s): s is Polygon => s.shape === "polygon" && s.fill === fill)
		.sort((a, b) => ys(a)[0] - ys(b)[0] || xs(a)[0] - xs(b)[0]);
}

function xs(p: Polygon): [number, number] {
	const all = p.points.map(([x]) => x);
	return [Math.min(...all), Math.max(...all)];
}

function ys(p: Polygon): [number, number] {
	const all = p.points.map(([, y]) => y);
	return [Math.min(...all), Math.max(...all)];
}

function middle(p: Polygon): number {
	return (ys(p)[0] + ys(p)[1]) / 2;
}

/** The texts set in `face`, top to bottom, then left to right. */
function texts(scene: SequenceScene, face: Text["face"]): Text[] {
	return scene.shapes
		.filter((s): s is Text => s.shape === "text" && s.face === face)
		.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** The labels' text, which is the only text at their size. */
function labels(scene: SequenceScene): Text[] {
	return texts(scene, "sans").filter((t) => t.size === 11.5);
}

/** The x of each leader, top to bottom, then left to right. */
function leaders(scene: SequenceScene): number[] {
	return scene.shapes
		.filter(
			(s): s is Line =>
				s.shape === "line" && s.stroke === "#7f7f7f" && s.strokeWidth === 0.8,
		)
		.sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1)
		.map((s) => s.x1);
}

/** The paths stroked `stroke`, each as its points, top to bottom, then left to right. */
function paths(scene: SequenceScene, stroke: string): number[][][] {
	return scene.shapes
		.filter((s): s is Path => s.shape === "path" && s.stroke === stroke)
		.map((p) => p.commands.map(([, x, y]) => [x as number, y as number]))
		.sort((a, b) => a[0][1] - b[0][1] || a[0][0] - b[0][0]);
}

/** The lines stroked `stroke`, each as its two ends, sorted by y1, x1, y2, then x2. */
function strokes(scene: SequenceScene, stroke: string): number[][] {
	return scene.shapes
		.filter((s): s is Line => s.shape === "line" && s.stroke === stroke)
		.map((s) => [s.x1, s.y1, s.x2, s.y2])
		.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[3] - b[3] || a[2] - b[2]);
}

function rects(scene: SequenceScene, fill: string): Rect[] {
	return scene.shapes
		.filter((s): s is Rect => s.shape === "rect" && s.fill === fill)
		.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Each row's strands, each from its top to its bottom, and its rail, top to bottom. */
function strands(scene: SequenceScene): {
	top: [number, number];
	rail: number;
	bottom: [number, number] | null;
}[] {
	const extent = (t: Text): [number, number] => {
		const top = t.y - metrics("mono").ascent * 11;
		return [top, top + height("mono", 11)];
	};
	const letters = texts(scene, "mono");
	return scene.shapes
		.filter((s): s is Line => s.shape === "line" && s.strokeWidth === 1.6)
		.map((s) => s.y1)
		.sort((a, b) => a - b)
		.map((rail) => {
			const above = letters.filter((t) => t.y < rail).at(-1) as Text;
			// A bottom strand lies just under the rail, nearer than the next row's top strand.
			const below = letters.find((t) => t.y > rail && t.y < rail + 20);
			return {
				top: extent(above),
				rail,
				bottom: below ? extent(below) : null,
			};
		});
}

describe("a primer", () => {
	test("lies as an arrow along its site, a forward one above the numbers and a reverse one under the strands, its head at the 3' end, 6 long and 2 beyond its band", () => {
		const scene = lay({
			primers: [
				primer("fwd", [{ start: 2, end: 12, strand: 1 }]),
				primer("rev", [{ start: 20, end: 30, strand: -1 }]),
			],
		});
		const [fwd, rev] = polygons(scene, PRIMER);
		expect(polygons(scene, PRIMER)).toHaveLength(2);
		const around = (p: Polygon) => p.points.map(([x, y]) => [x, y - middle(p)]);
		expect(around(fwd)).toEqual([
			[22, -2],
			[126, -2],
			[126, -4],
			[132, 0],
			[126, 4],
			[126, 2],
			[22, 2],
		]);
		expect(around(rev)).toEqual([
			[220, 0],
			[226, -4],
			[226, -2],
			[330, -2],
			[330, 2],
			[226, 2],
			[226, 4],
		]);
		const [{ top, bottom }] = strands(scene);
		const ten = texts(scene, "sans").find((t) => t.text === "10") as Text;
		expect(ys(fwd)[1]).toBeLessThan(ten.y);
		expect(ys(rev)[0]).toBeGreaterThan(bottom?.[1] ?? 0);
		expect(top[1]).toBeLessThan(ys(rev)[0]);
	});

	test("takes a tier by start, 12.75 from the last, the first nearest the bases", () => {
		const scene = lay({
			primers: [
				primer("a", [{ start: 2, end: 12, strand: 1 }]),
				primer("b", [{ start: 8, end: 16, strand: 1 }]),
				primer("c", [{ start: 20, end: 30, strand: -1 }]),
				primer("d", [{ start: 25, end: 35, strand: -1 }]),
			],
		});
		const [b, a, c, d] = polygons(scene, PRIMER);
		expect([a, b, c, d].map((p) => xs(p)[0])).toEqual([22, 88, 220, 275]);
		expect(middle(a) - middle(b)).toBeCloseTo(12.75, 9);
		expect(middle(d) - middle(c)).toBeCloseTo(12.75, 9);
	});

	test("is labelled by name and site above each row holding part of its site, on a leader from the row's top", () => {
		const scene = lay(
			{
				primers: [
					primer("a", [{ start: 8, end: 14, strand: 1 }], 3),
					primer("b", [{ start: 22, end: 26, strand: -1 }], 5),
				],
			},
			{ bases_per_row: 10 },
		);
		expect(labels(scene).map((t) => [t.text, t.fill])).toEqual([
			["a (9 .. 14)", PRIMER],
			["a (9 .. 14)", PRIMER],
			["b (23 .. 26)", PRIMER],
		]);
		expect(leaders(scene)).toEqual([99, 22, 44]);
		const rows = strands(scene);
		const feet = scene.shapes
			.filter((s): s is Line => s.shape === "line" && s.stroke === "#7f7f7f")
			.filter((s) => s.strokeWidth === 0.8)
			.map((s) => s.y1);
		for (const [i, foot] of feet.entries()) {
			expect(foot).toBeLessThan(rows[i].top[0]);
			expect(foot).toBeGreaterThan(labels(scene)[i].y);
		}
	});
});

describe("a primer's tail", () => {
	test("runs a base to a cell from the 5' end of its site, bent 6 away from the bases, on into the row before", () => {
		const scene = lay(
			{
				primers: [
					primer("fwd", [{ start: 12, end: 18, strand: 1 }], 5),
					primer("rev", [{ start: 22, end: 25, strand: -1 }], 1),
				],
			},
			{ bases_per_row: 10 },
		);
		const [fwd, rev] = polygons(scene, PRIMER);
		const [up, down] = [middle(fwd), middle(rev)];
		const [first, second] = strands(scene).map(({ top }) => top[0]);
		const level = first - (second - up) - 6;
		expect(paths(scene, PRIMER)).toEqual([
			[
				[110, level],
				[77, level],
			],
			[
				[22, up],
				[11, up - 6],
				[0, up - 6],
			],
			[
				[55, down],
				[66, down + 6],
			],
		]);
		const tail = scene.shapes.find(
			(s) => s.shape === "path" && s.stroke === PRIMER,
		);
		expect(tail).toMatchObject({ fill: "none", strokeWidth: 1.5 });
	});

	test("is drawn only where the row holds it, not in a row its site runs on into", () => {
		const scene = lay(
			{
				primers: [
					primer("fwd", [{ start: 8, end: 14, strand: 1 }], 2),
					primer("rev", [{ start: 16, end: 22, strand: -1 }], 2),
				],
			},
			{ bases_per_row: 10 },
		);
		expect(
			paths(scene, PRIMER).map((points) => points.map(([x]) => x)),
		).toEqual([
			[88, 77, 66],
			[22, 33, 44],
		]);
	});
});

describe("a primer's mismatch", () => {
	test("is marked red in its cell, as tall as the arrow's head, on either side of the origin", () => {
		const scene = lay(
			{
				circular: true,
				primers: [
					primer("across", [
						{ start: 35, end: 45, strand: 1, mismatches: [2, 37] },
					]),
				],
			},
			{ bases_per_row: 20 },
		);
		const marks = rects(scene, "#cc3311");
		expect(marks.map((r) => [r.x, r.width, r.stroke, r.strokeWidth])).toEqual([
			[24, 7, "none", 0],
			[189, 7, "none", 0],
		]);
		const arrows = polygons(scene, PRIMER);
		for (const [i, mark] of marks.entries()) {
			expect(mark.y + mark.height / 2).toBeCloseTo(middle(arrows[i]), 9);
			expect(mark.height).toBe(8);
		}
	});
});

describe("a cut site", () => {
	test("is boxed over its recognition span through both strands, cut through the top strand, along the rail and through the bottom strand", () => {
		const scene = lay({ cuts: [cut("EcoRI", 10, 16, 11, 4)] });
		const [{ top, rail, bottom }] = strands(scene);
		const [box] = rects(scene, "none");
		expect(box).toMatchObject({
			x: 110,
			width: 66,
			stroke: "#7f7f7f",
			strokeWidth: 0.8,
		});
		expect(box.y).toBeCloseTo(top[0], 9);
		expect(box.y + box.height).toBeCloseTo(bottom?.[1] ?? 0, 9);
		expect(strokes(scene, INK)).toEqual([
			[121, top[0], 121, rail],
			[121, rail, 165, rail],
			[165, rail, 165, bottom?.[1]],
		]);
		const widths = scene.shapes.flatMap((s) =>
			s.shape === "line" && s.stroke === INK ? [s.strokeWidth] : [],
		);
		expect(new Set(widths)).toEqual(new Set([1.2]));
	});

	test("is drawn in every row its overhang reaches, and labelled in the row holding its top-strand cut, the later one when blunt", () => {
		const scene = lay(
			{
				cuts: [
					cut("Over", 16, 22, 18, 4),
					cut("Edge", 25, 31, 30, -4),
					cut("Blunt", 7, 13, 10, 0),
				],
			},
			{ bases_per_row: 10 },
		);
		const [, one, two] = strands(scene);
		expect(strokes(scene, INK)).toEqual([
			[0, one.top[0], 0, one.rail],
			[88, one.top[0], 88, one.rail],
			[0, one.rail, 0, one.bottom?.[1]],
			[88, one.rail, 110, one.rail],
			[110, two.top[0], 110, two.rail],
			[0, two.rail, 22, two.rail],
			[22, two.rail, 22, two.bottom?.[1]],
			[66, two.rail, 110, two.rail],
			[66, two.rail, 66, two.bottom?.[1]],
		]);
		const named = labels(scene).filter((t) => t.text.startsWith(" ("));
		expect(named.map((t) => t.text)).toEqual([" (10)", " (18)", " (30)"]);
		expect(leaders(scene)).toEqual([0, 88, 110]);
	});

	test("across the origin is boxed and cut on both sides of it, and labelled once", () => {
		const scene = lay(
			{
				circular: true,
				cuts: [cut("Seam", 39, 45, 0, 4), cut("Back", 0, 4, 1, -4)],
			},
			{ bases_per_row: 20 },
		);
		const boxes = rects(scene, "none")
			.map((r) => [r.x, r.x + r.width])
			.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
		expect(boxes).toEqual([
			[0, 44],
			[0, 55],
			[209, 220],
		]);
		const [one, two] = strands(scene);
		expect(strokes(scene, INK)).toEqual([
			[0, one.top[0], 0, one.rail],
			[11, one.top[0], 11, one.rail],
			[0, one.rail, 11, one.rail],
			[0, one.rail, 44, one.rail],
			[44, one.rail, 44, one.bottom?.[1]],
			[187, two.rail, 220, two.rail],
			[187, two.rail, 187, two.bottom?.[1]],
		]);
		const named = labels(scene).filter((t) => t.text.startsWith(" ("));
		expect(named.map((t) => t.text)).toEqual([" (40)", " (1)"]);
	});

	test("with one strand, is boxed and cut through the top strand down to the rail, and no further", () => {
		const scene = lay(
			{ cuts: [cut("EcoRI", 10, 16, 11, 4)] },
			{ bottom_strand: false },
		);
		const [{ top, rail }] = strands(scene);
		const [box] = rects(scene, "none");
		expect([box.y, box.y + box.height]).toEqual([top[0], rail]);
		expect(strokes(scene, INK)).toEqual([[121, top[0], 121, rail]]);
	});
});

describe("cut sites", () => {
	test("are those of the enzymes on, the unique cutters by default, whatever their case", () => {
		const record = {
			cuts: [
				cut("EcoRI", 2, 8, 3, 4),
				cut("EcoRI", 22, 28, 23, 4),
				cut("SacI", 30, 36, 35, -4),
			],
		};
		const boxes = (options: object) =>
			rects(lay(record, options), "none").map((r) => r.x);
		expect(boxes({})).toEqual([330]);
		expect(boxes({ enzymes: ["ecori"] })).toEqual([22, 242]);
		expect(boxes({ enzymes: ["SacI"], kinds_off: ["cuts"] })).toEqual([]);
	});
});

describe("an insertion", () => {
	test("is a line through both strands at its point, in the row holding the base after it, labelled with what it adds", () => {
		const scene = lay(
			{
				insertions: [
					{ name: "a", at: 10, length: 8 },
					{ name: "b", at: 40, length: 2, color: "#00AA00" },
				],
			},
			{ bases_per_row: 10 },
		);
		const rows = strands(scene);
		const lines = scene.shapes.filter(
			(s): s is Line => s.shape === "line" && s.strokeWidth === 2,
		);
		expect(
			lines.map((s) => [s.x1, s.y1, s.x2, s.y2, s.stroke, s.hover]),
		).toEqual([
			[0, rows[1].top[0], 0, rows[1].bottom?.[1], "#cc3311", "a · 10^11"],
			[110, rows[3].top[0], 110, rows[3].bottom?.[1], "#00aa00", "b · 40^41"],
		]);
		expect(labels(scene).map((t) => [t.text, t.fill])).toEqual([
			["+8 bp", "#cc3311"],
			["+2 bp", "#00aa00"],
		]);
	});

	test("with one strand, runs through the top strand down to the rail", () => {
		const scene = lay(
			{ insertions: [{ name: "a", at: 10, length: 8 }] },
			{ bottom_strand: false },
		);
		const [line] = scene.shapes.filter(
			(s): s is Line => s.shape === "line" && s.strokeWidth === 2,
		);
		const [{ top, rail }] = strands(scene);
		expect([line.y1, line.y2]).toEqual([top[0], rail]);
	});
});

describe("a highlight", () => {
	const record = {
		features: [
			{
				name: "Lit",
				type: "misc_feature",
				strand: 1,
				segments: [{ start: 0, end: 4 }],
			},
		],
		primers: [
			primer("p1", [{ start: 8, end: 14, strand: 1, mismatches: [10] }], 2),
		],
		cuts: [cut("EcoRI", 20, 26, 21, 4)],
		insertions: [{ name: "ins", at: 30, length: 8 }],
	};

	/** Each paint of the primer's, the cut site's and the insertion's marks and labels. */
	function paints(scene: SequenceScene): string[] {
		return scene.shapes.flatMap((s) => {
			switch (s.shape) {
				case "text":
					return s.size === 11.5 && s.text !== "Lit" ? [s.fill] : [];
				case "polygon":
					return s.fill === "#77aadd" ? [] : [s.fill, s.stroke];
				case "rect":
					return [s.fill, s.stroke];
				case "path":
					return s.strokeWidth === 1.5 ? [s.stroke] : [];
				case "line":
					return [1.2, 2].includes(s.strokeWidth) ? [s.stroke] : [];
				default:
					return [];
			}
		});
	}

	test("dims every paint of an unlit primer, cut site and insertion to one grey, and moves nothing", () => {
		const plain = lay(record);
		const lit = lay(record, { highlight: ["lit"] });
		expect(new Set(paints(lit))).toEqual(
			new Set(["#dddddd", "#636363", "none"]),
		);
		const where = (scene: SequenceScene) =>
			scene.shapes.map((s) =>
				Object.entries(s).filter(([key]) => key !== "fill" && key !== "stroke"),
			);
		expect(where(lit)).toEqual(where(plain));
		expect(lit.extent).toEqual(plain.extent);
	});

	test("keeps the paints of what it names", () => {
		const lit = lay(record, { highlight: ["P1", "ecori", "INS"] });
		expect(paints(lit)).toEqual(paints(lay(record)));
		expect(paints(lit)).toContain("#cc3311");
	});
});
