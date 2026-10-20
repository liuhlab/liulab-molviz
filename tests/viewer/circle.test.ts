import { describe, expect, test } from "vitest";
import { boxOf } from "../../src/viewer/bounds";
import { layoutCircle } from "../../src/viewer/circle";
import { type Hidden, type MapScene, notice } from "../../src/viewer/labels";
import { checkOptions } from "../../src/viewer/options";
import { check, type Record } from "../../src/viewer/record";
import type { Box, PathCommand, Scene, Shape } from "../../src/viewer/scene";
import { baseline, height, measure, metrics } from "../../src/viewer/text";
import ap1File from "../records/ap1-product.json";
import colourTestFile from "../records/colour-test.json";
import puc19File from "../records/puc19-gfp-product.json";
import verifiedFile from "../records/puc19-gfp-verification.json";
import { enzymesOf, labelsOf, RECORDS } from "./apart";
import {
	closestToCentre,
	crosses,
	nearestToCentre,
	overlap,
	type Segment,
	TOUCH,
} from "./round";

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

/** The middle of the outermost ring's shaft: the ruler's numbers, a head's reach and half a shaft in. */
const OUTER = 220 - 3.8 - 1.3 - 6 - 2 - height("sans", 10.5) - 4 - 7.5;

/** The arrows filled `color`. */
function arrows(scene: Scene, color: string): Path[] {
	return paths(scene).filter((p) => p.fill === color);
}

/** The angles, in degrees, of the points of `path` on the middle of its shaft, where a head's tip is. */
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
			const shaft = [OUTER - 7.5, OUTER + 7.5].map((r) => Number(r.toFixed(3)));
			const heads = [OUTER - 11.5, OUTER + 11.5].map((r) =>
				Number(r.toFixed(3)),
			);
			expect(radii(arrow)).toEqual(
				strand === 0
					? shaft
					: [heads[0], shaft[0], OUTER, shaft[1], heads[1]].map((r) =>
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

/** The middle of the shaft of an arrow with no heads. */
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

	test("come closer together, their shafts thinner, once they would pass 0.4 of the radius", () => {
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
		const name = "pTEST-a-long-name-fo";
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
		expect(corner).toBeLessThan(88);
		expect(innermost).toBeCloseTo(corner, 6);
	});
});

/** Eight features on rings of their own, which reach in to 0.4 of the radius. */
const EIGHT_RINGS: Made[] = Array.from({ length: 8 }, (_, i) => ({
	segments: [[0, 100 + 10 * i]],
	color: `#00000${i + 1}`,
}));

describe("a name too wide for the centre", () => {
	// Each name, and how its lines join up again: at spaces, after `-` or `_`, or anywhere.
	test.each([
		["pTEST-a-long-name-for-a-record", "-"],
		["pTEST_a_long_name_for_a_record", "_"],
		["a plasmid with a name of many short words", " "],
		["x".repeat(60), ""],
		["pUC19 GFPinsertwithoutanywheretobreakatall", "a space, then anywhere"],
	])(
		"%s wraps onto lines inside 0.4 of the radius, which the rings keep clear of",
		(name, at) => {
			const scene = lay(EIGHT_RINGS, { record: { name } });
			const middle = texts(scene).filter((t) => t.rotate === undefined);
			const named = middle.filter((t) => t.face === "sans-bold");
			const lines = named.map((t) => t.text);
			expect(lines.length).toBeGreaterThan(1);
			const joined =
				at === " "
					? lines.join(" ")
					: at.length > 1
						? `${lines[0]} ${lines.slice(1).join("")}`
						: lines.join("");
			expect(joined).toBe(name);
			if (at === "-" || at === "_")
				for (const line of lines.slice(0, -1))
					expect(line.endsWith(at)).toBe(true);
			for (const t of middle) expect([t.x, t.anchor]).toEqual([0, "middle"]);
			const wide = Math.max(
				...middle.map((t) => measure(t.text, t.face, t.size)),
			);
			const tall = middle.reduce((sum, t) => sum + height(t.face, t.size), 0);
			const corner = Math.hypot(wide / 2, tall / 2);
			expect(corner).toBeLessThanOrEqual(88);
			const top = named[0].y - metrics("sans-bold").ascent * 13.5;
			expect(top).toBeCloseTo(-tall / 2);
			const innermost = Math.min(
				...paths(scene)
					.filter((p) => p.fill !== "none")
					.map(nearest),
			);
			expect(innermost).toBeGreaterThanOrEqual(corner - 1e-9);
			expect(innermost).toBeGreaterThan(88 - (0.46 * (OUTER - 88)) / 7 - 1);
		},
	);

	test("breaks at a space before it breaks a word", () => {
		const name = "pUC19 with-a-very-long-insert-name-in-it";
		const scene = lay([], { record: { name } });
		const lines = texts(scene)
			.filter((t) => t.face === "sans-bold")
			.map((t) => t.text);
		expect(lines[0]).toBe("pUC19");
		expect(lines.slice(1).join("")).toBe("with-a-very-long-insert-name-in-it");
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

	test("fits when it and 3 points either side span no more than the shaft", () => {
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

	test("goes in a column when the shafts are too thin for its letters", () => {
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

/** How far a primer's heads reach beyond its shaft 4 points thick, as a feature's do in proportion. */
const PRIMER_REACH = (4 * 4) / 15;

/** The middle of the first ring of primers: 2 points and a head's reach beyond the backbone. */
const PRIMER_MIDDLE = 221.3 + 2 + PRIMER_REACH + 2;

/** The radii of a primer's arrow with a head, its shaft's middle at `middle`. */
function primerRadii(middle: number): number[] {
	return [-2 - PRIMER_REACH, -2, 0, 2, 2 + PRIMER_REACH].map((d) =>
		Number((middle + d).toFixed(3)),
	);
}

/** A primer named `name` binding at each of `sites`, `[start, end, strand]`. */
function primer(name: string, sites: [number, number, number][]) {
	return {
		name,
		bases: "A".repeat(300),
		sites: sites.map(([start, end, strand]) => ({ start, end, strand })),
	};
}

describe("a primer", () => {
	test("draws a thin arrow outside the backbone at each site, its head at the 3' end, one overlapping further out", () => {
		const scene = lay([], {
			record: {
				primers: [
					primer("p1", [
						[0, 250, 1],
						[500, 750, -1],
					]),
					primer("p2", [[200, 300, 1]]),
				],
			},
		});
		const [first, second, third, ...more] = arrows(scene, "#aa3377");
		expect(more).toEqual([]);
		expect(radii(first)).toEqual(primerRadii(PRIMER_MIDDLE));
		expect(tips(first, PRIMER_MIDDLE)).toEqual([90]);
		expect(tips(second, PRIMER_MIDDLE)).toEqual([180]);
		const further = PRIMER_MIDDLE + 4 + 2 * PRIMER_REACH + 2;
		expect(radii(third)).toEqual(primerRadii(further));
		expect(tips(third, further)).toEqual([108]);
	});

	test("is labelled by name and bases, unboxed in its colour, on a leader from beyond the primers", () => {
		const scene = lay([], {
			record: { primers: [primer("p1", [[100, 110, 1]])] },
		});
		const [label] = texts(scene).filter((t) => t.text === "p1 (101 .. 110)");
		expect([label.fill, label.face]).toEqual(["#aa3377", "sans"]);
		expect(rects(scene)).toEqual([]);
		const [leader, ...more] = leaders(scene);
		expect(more).toEqual([]);
		expect(Math.hypot(leader.x1, leader.y1)).toBeCloseTo(
			PRIMER_MIDDLE + 2 + PRIMER_REACH + 4,
		);
		expect(degreesOf(leader.x1, leader.y1)).toBeCloseTo(37.8);
		expect(leader.x2).toBeCloseTo(label.x - 3);
	});
});

/** The lines from a label to what it names. */
function leaders(scene: Scene): Line[] {
	return lines(scene).filter((l) => l.stroke === "#7f7f7f");
}

describe("a cut site", () => {
	test("is labelled by its enzymes and the base before the cut, on a leader carried on to the backbone", () => {
		const scene = lay([], {
			record: {
				cuts: [
					{ enzyme: "SacI", start: 400, end: 406, at: 405, stagger: -4 },
					{ enzyme: "BanII", start: 400, end: 406, at: 405, stagger: -4 },
					{ enzyme: "BanII", start: 700, end: 706, at: 705, stagger: -4 },
				],
			},
			options: { enzymes: ["BanII", "SacI"] },
		});
		const runs = texts(scene).filter((t) => t.size === 11.5);
		expect(runs.map((t) => [t.text, t.face, t.fill])).toEqual([
			["BanII - ", "sans", "#000000"],
			["SacI", "sans-bold", "#000000"],
			[" (405)", "sans", "#000000"],
			["BanII (705)", "sans", "#000000"],
		]);
		expect(rects(scene)).toEqual([]);
		const [inward, leader] = leaders(scene);
		expect(Math.hypot(inward.x1, inward.y1)).toBeCloseTo(221.3);
		expect(degreesOf(inward.x1, inward.y1)).toBeCloseTo(145.8);
		expect([inward.x2, inward.y2]).toEqual([leader.x1, leader.y1]);
		expect(Math.hypot(leader.x1, leader.y1)).toBeCloseTo(225.3);
		expect(degreesOf(leader.x1, leader.y1)).toBeCloseTo(145.8);
		expect(leader.x2).toBeCloseTo(runs[0].x - 3);
		expect(leaders(scene)).toHaveLength(4);
	});

	test("at the origin reads the record's length", () => {
		const scene = lay([], {
			record: {
				cuts: [{ enzyme: "EcoRI", start: 999, end: 1005, at: 0, stagger: 4 }],
			},
		});
		expect(texts(scene).map((t) => t.text)).toContain(" (1000)");
	});
});

describe("an insertion", () => {
	test("draws a bar across the backbone, labelled with what it adds in its colour, its name and point on hover", () => {
		const scene = lay([], {
			record: {
				insertions: [
					{ name: "ins", at: 250, length: 8 },
					{ name: "", at: 750, length: 1, color: "#00AA00" },
				],
			},
		});
		const bars = lines(scene).filter((l) => l.strokeWidth === 2);
		expect(bars.map((b) => [b.stroke, b.title])).toEqual([
			["#cc3311", "ins · 250^251"],
			["#00aa00", "750^751"],
		]);
		const [bar] = bars;
		expect([bar.y1, bar.y2]).toEqual([0, 0].map(() => expect.closeTo(0)));
		expect([bar.x1, bar.x2]).toEqual([
			expect.closeTo(214.9 - 1.5),
			expect.closeTo(221.3 + 1.5),
		]);
		const labels = texts(scene).filter((t) => t.size === 11.5);
		expect(labels.map((t) => [t.text, t.fill])).toEqual([
			["+8 bp", "#cc3311"],
			["+1 bp", "#00aa00"],
		]);
		const [inward] = leaders(scene);
		expect([inward.x1, inward.y1]).toEqual([
			expect.closeTo(221.3),
			expect.closeTo(0),
		]);
	});
});

/** A record of one item of each kind, a source feature, and an enzyme that cuts twice. */
const EVERY_KIND = {
	features: [
		{
			name: "f",
			type: "misc_feature",
			strand: 1,
			color: "#000080",
			segments: [{ start: 100, end: 110 }],
		},
		{
			name: "all",
			type: "source",
			strand: 0,
			segments: [{ start: 0, end: 1000 }],
		},
	],
	primers: [primer("p1", [[300, 320, 1]])],
	cuts: [
		{ enzyme: "EcoRI", start: 500, end: 506, at: 501, stagger: 4 },
		{ enzyme: "BamHI", start: 600, end: 606, at: 601, stagger: 4 },
		{ enzyme: "BamHI", start: 800, end: 806, at: 801, stagger: 4 },
	],
	insertions: [{ name: "ins", at: 700, length: 3 }],
};

/** What the labels say, a run at a time. */
function said(scene: Scene): string[] {
	return texts(scene)
		.filter((t) => t.size === 11.5)
		.map((t) => t.text);
}

/** The colours of the marks drawn on the circle: arrows, then insertions' bars. */
function marks(scene: Scene): string[] {
	return [
		...paths(scene).filter((p) => p.fill !== "none"),
		...lines(scene).filter((l) => l.strokeWidth === 2),
	].map((s) => ("fill" in s ? s.fill : s.stroke));
}

describe("the options", () => {
	test("draw every kind, the cut sites of the unique cutters, and no source feature, by default", () => {
		const scene = lay([], { record: EVERY_KIND });
		expect(said(scene)).toEqual([
			"f",
			"p1 (301 .. 320)",
			"EcoRI",
			" (501)",
			"+3 bp",
		]);
		expect(marks(scene)).toEqual(["#000080", "#aa3377", "#cc3311"]);
	});

	test.each([
		["features", ["p1 (301 .. 320)", "EcoRI", " (501)", "+3 bp"]],
		["primers", ["f", "EcoRI", " (501)", "+3 bp"]],
		["cuts", ["f", "p1 (301 .. 320)", "+3 bp"]],
		["insertions", ["f", "p1 (301 .. 320)", "EcoRI", " (501)"]],
	])("leave out every %s, marks and labels, switched off", (kind, left) => {
		const scene = lay([], {
			record: EVERY_KIND,
			options: { kinds_off: [kind] },
		});
		expect(said(scene)).toEqual(left);
		const drawn = {
			features: "#000080",
			primers: "#aa3377",
			cuts: "",
			insertions: "#cc3311",
		};
		expect(marks(scene)).toEqual(
			Object.entries(drawn).flatMap(([k, color]) =>
				k === kind || !color ? [] : [color],
			),
		);
	});

	test("draw the cut sites of the enzymes named, and the feature types not switched off", () => {
		const scene = lay([], {
			record: EVERY_KIND,
			options: { enzymes: ["bamhi"], types_off: ["misc_feature"] },
		});
		expect(said(scene)).toEqual([
			"p1 (301 .. 320)",
			"BamHI (601)",
			"BamHI (801)",
			"+3 bp",
		]);
		expect(letters(scene).map((l) => l.text)).toEqual(["all"]);
	});
});

/** Where each shape of `scene` is and what it says, its paints left out, and the extent. */
function geometry({ extent, shapes }: Scene) {
	const unpainted = shapes.map((shape) =>
		Object.entries(shape).filter(([key]) => key !== "fill" && key !== "stroke"),
	);
	return { extent, unpainted };
}

describe("a highlight", () => {
	test("dims every paint of what it leaves unlit to one grey, and keeps the lit one's and the leaders", () => {
		const scene = lay([], {
			record: EVERY_KIND,
			options: { highlight: ["p1"] },
		});
		expect(marks(scene)).toEqual(["#dddddd", "#aa3377", "#dddddd"]);
		expect(rects(scene).map((r) => [r.fill, r.stroke])).toEqual([
			["#dddddd", "#636363"],
		]);
		const fills = texts(scene)
			.filter((t) => t.size === 11.5)
			.map((t) => [t.text, t.fill]);
		expect(fills).toEqual([
			["f", "#000000"],
			["p1 (301 .. 320)", "#aa3377"],
			["EcoRI", "#dddddd"],
			[" (501)", "#dddddd"],
			["+3 bp", "#dddddd"],
		]);
		expect(new Set(leaders(scene).map((l) => l.stroke))).toEqual(
			new Set(["#7f7f7f"]),
		);
	});

	test.each([
		["pUC19-GFP", puc19File, ["GFP", "M13 rev", "NcoI"]],
		["colour-test", colourTestFile, ["split"]],
	])("on %s moves nothing", (_, file, highlight) => {
		const record = check(file);
		const plain = layoutCircle(record, checkOptions({}, record));
		const lit = layoutCircle(record, checkOptions({ highlight }, record));
		expect(geometry(lit)).toEqual(geometry(plain));
		expect(marks(lit).filter((c) => c !== "#dddddd").length).toBeGreaterThan(0);
		expect(marks(lit).filter((c) => c === "#dddddd").length).toBeGreaterThan(
			marks(plain).filter((c) => c === "#dddddd").length,
		);
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
	test("is larger, its shafts as thick, and gives its labels more room above and below", () => {
		const scene = lay(CROWD.slice(0, 1), { zoom: 2 });
		const strands = paths(scene).filter(
			(p) => p.fill === "none" && p.strokeWidth === 2.6,
		);
		expect(strands.map(radii)).toEqual([[440], [436.2]]);
		const [arrow] = paths(scene).filter((p) => p.fill !== "none");
		const shaft = radii(arrow);
		expect(shaft[shaft.length - 1] - shaft[0]).toBeCloseTo(15 + 2 * 4, 2);
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
	// The counts mbio's circle gives for the same records and enzymes.
	test.each([
		["pUC19-GFP", puc19File, false, 5, 4, 20, 0],
		["pUC19-GFP", puc19File, true, 5, 4, 26, 0],
		["AP-1", ap1File, false, 6, 0, 32, 0],
		["AP-1", ap1File, true, 6, 0, 46, 6],
		["colour-test", colourTestFile, false, 4, 4, 23, 0],
	])(
		"%s, every enzyme %s, takes as many rings, names on arrows, labels and hidden labels as mbio draws",
		(_, file, every, rings, named, labelled, hidden) => {
			const record = check(file);
			const options = every ? { enzymes: enzymesOf(file) } : {};
			const scene = layoutCircle(record, checkOptions(options, record));
			const middles = paths(scene)
				.filter((p) => p.fill !== "none")
				.map((p) => {
					const all = ends(p.commands).map(([x, y]) => Math.hypot(x, y));
					return ((Math.min(...all) + Math.max(...all)) / 2).toFixed(2);
				})
				.filter((middle) => Number(middle) < 220);
			expect(new Set(middles).size).toBe(rings);
			expect(letters(scene)).toHaveLength(named);
			expect(labelsOf(scene)).toHaveLength(labelled);
			expect(scene.hidden).toHaveLength(hidden);
		},
	);
});

test("AP-1 with every enzyme hides the sites of the enzymes that cut it most, as mbio's circle does", () => {
	const record = check(ap1File);
	const options = checkOptions({ enzymes: enzymesOf(ap1File) }, record);
	const hidden = layoutCircle(record, options).hidden.map(
		(one) => `${one.name} ${"at" in one ? one.at : one.spans[0].start}`,
	);
	// BtgZI cuts 7 times, BspQI and SapI 3, every other enzyme at most 2.
	expect(hidden).toEqual([
		"BtgZI 1864",
		"BtgZI 2233",
		"BtgZI 2396",
		"BtgZI 2577",
		"BspQI - SapI 2295",
		"BspQI - SapI 2505",
	]);
});

describe("pUC19-GFP's verification map", () => {
	// mbio's page draws its map with no cut sites, lighting the disagreements and the read.
	const record = check(verifiedFile);
	const scene = layoutCircle(
		record,
		checkOptions(
			{
				kinds_off: ["cuts"],
				highlight: ["696 A>G", "2687 C>T", "consensus.fasta"],
			},
			record,
		),
	);

	test("takes the room mbio's map takes", () => {
		const { x, y, width, height } = scene.extent;
		expect([x, y, width, height]).toEqual(
			[-327.74, -273.5, 812.6, 556.89].map((v) => expect.closeTo(v, 2)),
		);
	});

	test("draws the read as a ring just outside the backbone, its head at its end", () => {
		const [read, ...more] = arrows(scene, "#aa3377");
		expect(more).toEqual([]);
		expect(radii(read)).toEqual(primerRadii(PRIMER_MIDDLE));
		expect(tips(read, PRIMER_MIDDLE).map((d) => d % 360)).toEqual([0]);
	});

	test("boxes each disagreement's name in its colour in a column", () => {
		const boxed = rects(scene).filter((r) =>
			["#cc3311", "#bbbbbb"].includes(r.fill),
		);
		expect(boxed.map((r) => r.fill).sort()).toEqual(["#bbbbbb", "#cc3311"]);
		const names = texts(scene).filter((t) => / [ACGT]>[ACGT]$/.test(t.text));
		expect(names.map((t) => [t.text, t.fill]).sort()).toEqual([
			["2687 C>T", "#000000"],
			["696 A>G", "#ffffff"],
		]);
	});
});

describe("a disagreement", () => {
	/** A record with one read over it all and `disagreements` that it shows. */
	function verified(features: Made[], disagreements: object[]) {
		return {
			record: {
				reads: [{ name: "r1", start: 0, end: 1000, strand: 1 }],
				disagreements: disagreements.map((one) => ({
					bases: "A",
					reads: ["r1"],
					...one,
				})),
			},
			features,
		};
	}

	test("over a span packs into the features' rings, a bar in its colour with no heads", () => {
		const { record, features } = verified(
			[{ segments: [[0, 250]], color: "#000001" }],
			[{ name: "d", start: 100, end: 101, color: "#cc3311" }],
		);
		const scene = lay(features, { record });
		const [bar, ...more] = arrows(scene, "#cc3311");
		expect(more).toEqual([]);
		const inner = OUTER - 25;
		expect(radii(bar)).toEqual(
			[inner - 7.5, inner + 7.5].map((r) => Number(r.toFixed(3))),
		);
	});

	test("at a point is a bar across the backbone in its colour, labelled with its name, its name and point on hover", () => {
		const { record } = verified(
			[],
			[{ name: "insertion after 250", at: 250, color: "#ee7733" }],
		);
		const scene = lay([], { record, options: { kinds_off: ["reads"] } });
		const [mark, ...more] = lines(scene).filter((l) => l.stroke === "#ee7733");
		expect(more).toEqual([]);
		expect(mark.strokeWidth).toBe(2);
		expect(mark.title).toBe("insertion after 250 · 250^251");
		expect([mark.x1, mark.x2]).toEqual([
			expect.closeTo(214.9 - 1.5),
			expect.closeTo(221.3 + 1.5),
		]);
		const [label] = texts(scene).filter(
			(t) => t.text === "insertion after 250",
		);
		expect(label.fill).toBe("#ee7733");
		const [inward] = leaders(scene);
		expect([inward.x1, inward.y1]).toEqual([
			expect.closeTo(221.3),
			expect.closeTo(0),
		]);
	});

	test("is left out with its label when disagreements are off, as a read is when reads are off", () => {
		const { record, features } = verified(
			[],
			[
				{ name: "over", start: 100, end: 101, color: "#cc3311" },
				{ name: "at", at: 500, color: "#cc3311" },
			],
		);
		const off = lay(features, {
			record,
			options: { kinds_off: ["disagreements", "reads"] },
		});
		expect(off.shapes).toEqual(lay([]).shapes);
	});
});

/** `line` as a segment from one end to the other. */
function segment({ x1, y1, x2, y2 }: Line): Segment {
	return [
		{ x: x1, y: y1 },
		{ x: x2, y: y2 },
	];
}

const CIRCULAR = RECORDS.filter(([, file]) => file.circular);

/** Each kind's place in the order labels hide. */
const HIDING = [
	"cuts",
	"primers",
	"reads",
	"features",
	"insertions",
	"disagreements",
];

/** Where `hidden` comes in the order labels hide, for `record` with no highlight. */
function hidingKey(hidden: Hidden, record: Record): number[] {
	const length = record.bases.length;
	const counts = new Map<string, number>();
	for (const { enzyme } of record.cuts)
		counts.set(enzyme, (counts.get(enzyme) ?? 0) + 1);
	if ("at" in hidden) {
		if (hidden.kind === "insertions")
			return [HIDING.indexOf("insertions"), 0, 0];
		if (hidden.kind === "disagreements") {
			return [HIDING.indexOf("disagreements"), 0, -hidden.name.length];
		}
		const fewest = Math.min(
			...hidden.name.split(" - ").map((e) => counts.get(e) ?? 0),
		);
		const text = `${hidden.name} (${hidden.at || length})`;
		return [0, -fewest, -text.length];
	}
	const [{ start, end }] = hidden.spans;
	const text =
		hidden.kind === "primers" || hidden.kind === "reads"
			? `${hidden.name} (${(start % length) + 1} .. ${((end - 1) % length) + 1})`
			: hidden.name;
	return [HIDING.indexOf(hidden.kind), 0, -text.length];
}

function before(a: number[], b: number[]): boolean {
	for (const [i, value] of a.entries()) {
		if (value !== b[i]) return value < b[i];
	}
	return true;
}

describe.each(CIRCULAR)("%s drawn whole", (_, file) => {
	describe.each([
		["the unique cutters", {}],
		["every enzyme", { enzymes: enzymesOf(file) }],
	])("with %s", (__, given) => {
		describe.each([0, 100, 250])("turned %i degrees", (rotation) => {
			const record = check(file);
			const options = checkOptions(given, record);
			const scene = layoutCircle(record, options, rotation);
			const placed = labelsOf(scene);
			const boxes = placed.map(({ box }) => box);
			const backbone = 221.3;
			const drawing = Math.max(
				backbone,
				...paths(scene)
					.filter((p) => p.fill !== "none")
					.flatMap((p) => ends(p.commands).map(([x, y]) => Math.hypot(x, y))),
			);

			test("names each item once: on its arrow, in a column, or hidden", () => {
				const off = new Set(options.types_off);
				const on = new Set(options.enzymes);
				const items =
					record.features.filter((f) => !off.has(f.type) && f.name.trim())
						.length +
					record.primers.flatMap((p) => p.sites).length +
					new Set(record.cuts.filter((c) => on.has(c.enzyme)).map((c) => c.at))
						.size +
					record.insertions.length +
					record.reads.length +
					record.disagreements.filter(
						(d) => d.at !== undefined || d.name.trim(),
					).length;
				expect(
					letters(scene).length + placed.length + scene.hidden.length,
				).toBe(items);
			});

			test("no two labels overlap, and none overlaps the drawing", () => {
				const pairs = boxes.flatMap((one, k) =>
					boxes.slice(k + 1).filter((other) => overlap(one, other)),
				);
				expect(pairs).toEqual([]);
				for (const box of boxes)
					expect(nearestToCentre(box)).toBeGreaterThanOrEqual(drawing);
			});

			test("no leader enters the drawing or crosses another label", () => {
				for (const { leader, inward, box } of placed) {
					expect(closestToCentre(segment(leader))).toBeGreaterThanOrEqual(
						drawing - TOUCH,
					);
					if (inward) {
						expect(closestToCentre(segment(inward))).toBeCloseTo(backbone, 9);
						expect([inward.x2, inward.y2]).toEqual([leader.x1, leader.y1]);
					}
					const others = boxes.filter((other) => other !== box);
					expect(
						others.filter((other) => crosses(segment(leader), other)),
					).toEqual([]);
				}
			});

			test("every label lies within 390 points above and below the centre", () => {
				for (const box of boxes) {
					expect(box.y).toBeGreaterThanOrEqual(-390);
					expect(box.y + box.height).toBeLessThanOrEqual(390);
				}
			});

			test("labels hide in order", () => {
				const keys = scene.hidden.map((h) => hidingKey(h, record));
				for (const [k, key] of keys.slice(1).entries())
					expect(before(keys[k], key)).toBe(true);
			});

			test("the notice sits at the bottom right, clear of everything", () => {
				const notices = texts(scene).filter((t) => t.text.endsWith("hidden"));
				expect(notices).toHaveLength(scene.hidden.length ? 1 : 0);
				for (const { text, title } of notices) {
					expect(text).toBe(notice(scene.hidden));
					expect(title?.split("\n")).toHaveLength(scene.hidden.length);
				}
				const { extent } = scene;
				for (const shown of notices) {
					const box = boxOf(shown) as Box;
					expect(box.x + box.width).toBeCloseTo(extent.x + extent.width - 16);
					expect(box.y + box.height).toBeLessThanOrEqual(
						extent.y + extent.height - 16,
					);
					expect(box.y).toBeGreaterThan(
						Math.max(drawing, ...boxes.map((b) => b.y + b.height)),
					);
				}
			});
		});
	});
});
