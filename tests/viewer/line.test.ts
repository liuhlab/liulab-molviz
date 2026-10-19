import { describe, expect, test } from "vitest";
import type { MapScene } from "../../src/viewer/labels";
import { layout } from "../../src/viewer/line";
import { checkOptions } from "../../src/viewer/options";
import { check } from "../../src/viewer/record";
import { leftEdge, type Scene, type Shape } from "../../src/viewer/scene";
import { measure, metrics } from "../../src/viewer/text";
import colourTestFile from "../records/colour-test.json";

const colourTest = check(colourTestFile);

/** The span the test records' README names for drawing `colour-test` across its origin. */
const ACROSS = { span: { start: 2600, end: 2750 } };

/** A linear record of 1000 bases: drawn 720 points long, each base is 0.72 points. */
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
	options: object = {},
	record: object = {},
	width?: number,
): MapScene {
	const checked = check({
		name: "test",
		circular: false,
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
	return layout(checked, checkOptions(options, checked), width);
}

type Polygon = Extract<Shape, { shape: "polygon" }>;

/** The arrows filled `color`, left to right. */
function arrows(scene: Scene, color: string): Polygon[] {
	return scene.shapes
		.filter((s): s is Polygon => s.shape === "polygon" && s.fill === color)
		.sort((a, b) => left(a) - left(b));
}

function left(p: Polygon): number {
	return Math.min(...p.points.map(([x]) => x));
}

function right(p: Polygon): number {
	return Math.max(...p.points.map(([x]) => x));
}

function middle(p: Polygon): number {
	const ys = p.points.map(([, y]) => y);
	return (Math.min(...ys) + Math.max(...ys)) / 2;
}

/** The x of each point of `p` level with its middle, where a head's tip is. */
function tips(p: Polygon): number[] {
	return p.points
		.filter(([, y]) => y === middle(p))
		.map(([x]) => x)
		.sort((a, b) => a - b);
}

describe("arrows", () => {
	test.each([
		[1, [360]],
		[-1, [72]],
		[0, []],
		[2, [72, 360]],
	])("on strand %i have their heads' tips at %j", (strand, expected) => {
		const scene = lay([{ strand, segments: [[100, 500]], color: "#000001" }]);
		const [arrow] = arrows(scene, "#000001");
		expect(tips(arrow)).toEqual(expected);
		expect([left(arrow), right(arrow)]).toEqual([72, 360]);
	});

	test("take a head at most half as long as a short bar on both strands", () => {
		const scene = lay([
			{ strand: 2, segments: [[100, 110]], color: "#000001" },
		]);
		const [arrow] = arrows(scene, "#000001");
		const shoulders = arrow.points
			.map(([x]) => x)
			.filter((x) => x !== 72 && x !== 79.2);
		expect(new Set(shoulders.map((x) => x.toFixed(6)))).toEqual(
			new Set(["75.600000"]),
		);
	});

	test("take a head of a fixed length on a long bar", () => {
		const scene = lay([
			{ strand: 1, segments: [[100, 500]], color: "#000001" },
		]);
		const [arrow] = arrows(scene, "#000001");
		expect(new Set(arrow.points.map(([x]) => x))).toEqual(
			new Set([72, 348, 360]),
		);
	});
});

type Line = Extract<Shape, { shape: "line" }>;

function lines(scene: Scene, stroke: string): Line[] {
	return scene.shapes.filter(
		(s): s is Line => s.shape === "line" && s.stroke === stroke,
	);
}

describe("a feature the span cuts", () => {
	test("ends square where it is cut, with its head where it ends", () => {
		const feature = { strand: 1, segments: [[100, 600]], color: "#000001" };
		const late = lay([feature] as Made[], { span: { start: 200, end: 1000 } });
		const [cutAtStart] = arrows(late, "#000001");
		expect([left(cutAtStart), tips(cutAtStart)]).toEqual([0, [360]]);
		const early = lay([feature] as Made[], { span: { start: 0, end: 400 } });
		const [cutAtEnd] = arrows(early, "#000001");
		expect([right(cutAtEnd), tips(cutAtEnd)]).toEqual([720, []]);
	});

	test("lies at both ends where it runs across the origin of a circle drawn whole", () => {
		const scene = lay(
			[{ strand: 1, segments: [[900, 1100]], color: "#000001" }],
			{},
			{ circular: true },
		);
		const [after, before] = arrows(scene, "#000001");
		expect([left(after), right(after), tips(after)]).toEqual([0, 72, [72]]);
		expect([left(before), right(before), tips(before)]).toEqual([648, 720, []]);
	});
});

describe("a joined feature", () => {
	test("draws a bar per segment in one tier, the gaps a thin line, heads at its ends only", () => {
		const scene = lay([
			{
				strand: 1,
				segments: [
					[100, 200],
					[300, 400],
				],
				color: "#000001",
			},
			{ segments: [[220, 280]], color: "#000002" },
		]);
		const [first, second] = arrows(scene, "#000001");
		expect(middle(first)).toBe(middle(second));
		expect([tips(first), tips(second)]).toEqual([[], [288]]);
		const [gap] = lines(scene, "#666666");
		expect(gap).toMatchObject({ x1: 144, x2: 216, y1: middle(first) });
		// The bar spans the gap, so a feature inside it takes another tier.
		const [inside] = arrows(scene, "#000002");
		expect(middle(inside)).toBeGreaterThan(middle(first));
	});

	test("draws segments that meet with no line between them", () => {
		const scene = lay([
			{
				strand: -1,
				segments: [
					[100, 200],
					[200, 300],
				],
				color: "#000001",
			},
		]);
		const [first, second] = arrows(scene, "#000001");
		expect([tips(first), tips(second)]).toEqual([[72], []]);
		expect(lines(scene, "#666666")).toEqual([]);
	});
});

/** The x of each dot, left to right. */
function dots(scene: Scene): number[] {
	return scene.shapes
		.flatMap((s) => (s.shape === "circle" ? [s.cx] : []))
		.sort((a, b) => a - b);
}

describe("the ends", () => {
	test("carry three dots where the molecule goes on past the line", () => {
		expect(dots(lay([]))).toEqual([]);
		expect(dots(lay([], { span: { start: 200, end: 1000 } }))).toEqual([
			-19, -13, -7,
		]);
		expect(dots(lay([], { span: { start: 0, end: 400 } }))).toEqual([
			727, 733, 739,
		]);
		expect(dots(lay([], {}, { circular: true }))).toEqual([
			-19, -13, -7, 727, 733, 739,
		]);
	});
});

describe("a span across the origin", () => {
	const scene = layout(colourTest, checkOptions(ACROSS, colourTest));

	test("draws a feature across the origin whole, its head at its end", () => {
		const [across] = arrows(scene, "#993366");
		expect([left(across), right(across), tips(across)]).toEqual([
			0,
			720,
			[720],
		]);
	});
});

type Text = Extract<Shape, { shape: "text" }>;

function texts(scene: Scene, size: number): Text[] {
	return scene.shapes.filter(
		(s): s is Text => s.shape === "text" && s.size === size,
	);
}

/** The ruler's numbers, left to right. */
function numbers(scene: Scene): string[] {
	return texts(scene, 10.5)
		.filter((t) => t.y < 40)
		.sort((a, b) => a.x - b.x)
		.map((t) => t.text);
}

function steps(from: number, to: number, step: number): string[] {
	const out: string[] = [];
	for (let n = from; n <= to; n += step) out.push(String(n));
	return out;
}

describe("the ruler", () => {
	test.each([
		[1000, 100],
		[48, 5],
		[6435, 1000],
	])(
		"numbers %i bases every %i, 1-based, centred on each tick",
		(bases, step) => {
			const scene = lay([], {}, { bases: "A".repeat(bases) });
			expect(numbers(scene)).toEqual(steps(step, bases, step));
			const first = texts(scene, 10.5).find((t) => t.text === String(step));
			expect(first).toMatchObject({
				anchor: "middle",
				x: (step * 720) / bases,
			});
		},
	);

	test("numbers a span across the origin as the record does, with a long tick at the origin", () => {
		const scene = layout(colourTest, checkOptions(ACROSS, colourTest));
		expect(numbers(scene)).toEqual([
			...steps(2620, 2680, 20),
			...steps(20, 60, 20),
		]);
		const longest = lines(scene, "#252525")
			.filter((l) => l.x1 === l.x2)
			.sort((a, b) => b.y2 - b.y1 - (a.y2 - a.y1))[0];
		expect(longest.x1).toBe(((2686 - 2600) * 720) / 150);
	});

	test("keeps at most ten numbers per 720 points of a longer line", () => {
		const scene = lay(
			[{ segments: [[100, 500]], color: "#000001" }],
			{},
			{},
			1440,
		);
		expect(numbers(scene)).toEqual(steps(50, 1000, 50));
		const [arrow] = arrows(scene, "#000001");
		expect([left(arrow), right(arrow)]).toEqual([144, 720]);
		const backbone = lines(scene, "#252525").filter((l) => l.y1 === l.y2);
		expect(backbone.map((l) => [l.x1, l.x2])).toEqual([
			[0, 1440],
			[0, 1440],
		]);
		expect(texts(scene, 13.5)[0].x).toBe(720);
	});

	test("leaves out a number too near the origin's tick", () => {
		const options = { span: { start: 2650, end: 2700 } };
		const scene = layout(colourTest, checkOptions(options, colourTest));
		expect(numbers(scene)).toEqual([...steps(2655, 2680, 5), "5", "10"]);
	});
});

describe("the title", () => {
	test("gives the name in bold over the length, centred under the drawing", () => {
		const scene = lay([{ segments: [[0, 500]], color: "#000001" }]);
		const [name] = texts(scene, 13.5);
		const [length] = texts(scene, 10.5).filter((t) => t.y > 40);
		expect(name).toMatchObject({
			text: "test",
			face: "sans-bold",
			anchor: "middle",
			x: 360,
		});
		expect(length).toMatchObject({ text: "1000 bp", anchor: "middle", x: 360 });
		expect(length.y).toBeGreaterThan(name.y);
		const [arrow] = arrows(scene, "#000001");
		expect(name.y).toBeGreaterThan(Math.max(...arrow.points.map(([, y]) => y)));
	});

	test("gives a span's bases as the record numbers them", () => {
		const scene = layout(colourTest, checkOptions(ACROSS, colourTest));
		const [length] = texts(scene, 10.5).filter((t) => t.y > 40);
		expect(length.text).toBe("2601 .. 64 (150 bp)");
	});
});

describe("colours", () => {
	// The defaults are mbio's: Paul Tol's light scheme by type group, from `GROUPS`, `OTHER` and
	// `PRIMER` in liulab-mbio's `src/mbio/plot/layers.py`.
	test.each([
		["CDS", "#77aadd"],
		["gene", "#77aadd"],
		["promoter", "#ee8866"],
		["regulatory", "#ee8866"],
		["terminator", "#ffaabb"],
		["polyA_signal", "#ffaabb"],
		["rep_origin", "#eedd88"],
		["protein_bind", "#99ddff"],
		["ncRNA", "#44bb99"],
		["LTR", "#bbcc33"],
		["primer_bind", "#aa3377"],
		["misc_feature", "#dddddd"],
		["made_up", "#dddddd"],
	])("fill a %s with no colour of its own in %s", (type, color) => {
		const scene = lay([{ type, segments: [[0, 100]] }]);
		expect(arrows(scene, color)).toHaveLength(1);
	});

	test("take a feature's own colour, and a segment's over it", () => {
		const scene = lay([
			{
				type: "CDS",
				segments: [
					[0, 100],
					[200, 300],
				],
				color: "#123ABC",
			},
		]);
		const own = check({
			name: "test",
			circular: false,
			bases: BASES,
			features: [
				{
					name: "",
					type: "CDS",
					strand: 1,
					color: "#123abc",
					segments: [
						{ start: 0, end: 100 },
						{ start: 200, end: 300, color: "#00FF00" },
					],
				},
			],
		});
		const segmented = layout(own, checkOptions({}, own));
		expect(arrows(scene, "#123abc")).toHaveLength(2);
		expect(arrows(segmented, "#123abc")).toHaveLength(1);
		expect(arrows(segmented, "#00ff00")).toHaveLength(1);
	});

	test("outline an arrow in its fill darkened", () => {
		const scene = lay([{ segments: [[0, 100]], color: "#ffffff" }]);
		expect(arrows(scene, "#ffffff")[0]).toMatchObject({
			stroke: "#737373",
			strokeWidth: 0.8,
		});
	});
});

type Rect = Extract<Shape, { shape: "rect" }>;

/** The box a line of text takes, from its face's metrics. */
function box(t: Text) {
	const width = measure(t.text, t.face, t.size);
	const { ascent, descent } = metrics(t.face);
	const x = leftEdge(t, width);
	return {
		left: x,
		right: x + width,
		top: t.y - ascent * t.size,
		bottom: t.y + descent * t.size,
	};
}

function label(scene: Scene, name: string): Text {
	const found = texts(scene, 11.5).filter((t) => t.text === name);
	expect(found).toHaveLength(1);
	return found[0];
}

function rects(scene: Scene): Rect[] {
	return scene.shapes.filter((s): s is Rect => s.shape === "rect");
}

/** Whether two boxes share any area. */
function overlap(
	a: { left: number; right: number; top: number; bottom: number },
	b: { left: number; right: number; top: number; bottom: number },
): boolean {
	return (
		a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
	);
}

function edges(r: Rect) {
	return { left: r.x, right: r.x + r.width, top: r.y, bottom: r.y + r.height };
}

describe("a feature's name", () => {
	test("goes inside its arrow, centred on its band, when it fits", () => {
		const scene = lay([
			{ name: "lacZ", segments: [[100, 500]], color: "#000080" },
			{ name: "bla", segments: [[600, 900]], color: "#ffffcc" },
		]);
		const [dark] = arrows(scene, "#000080");
		const name = label(scene, "lacZ");
		const at = box(name);
		expect(at.left).toBeGreaterThanOrEqual(72 + 3);
		expect(at.right).toBeLessThanOrEqual(360 - 12 - 3);
		expect((at.top + at.bottom) / 2).toBeCloseTo(middle(dark), 9);
		expect(name.fill).toBe("#ffffff");
		expect(label(scene, "bla").fill).toBe("#000000");
		expect(rects(scene)).toEqual([]);
	});

	test("goes under its arrow when it does not fit inside, and the tier below makes room", () => {
		const scene = lay([
			{ name: "a long name", segments: [[100, 110]], color: "#000001" },
			{ segments: [[105, 300]], color: "#000002" },
		]);
		const [arrow] = arrows(scene, "#000001");
		const [below] = arrows(scene, "#000002");
		const at = box(label(scene, "a long name"));
		expect(label(scene, "a long name").anchor).toBe("middle");
		expect(label(scene, "a long name").x).toBeCloseTo(75.6, 9);
		expect(at.top).toBeGreaterThan(middle(arrow) + 7.5 + 4);
		expect(Math.min(...below.points.map(([, y]) => y))).toBeGreaterThan(
			at.bottom,
		);
		expect(rects(scene)).toEqual([]);
	});

	test("goes in a box above the backbone, on a leader, where neither fits", () => {
		// "first" fits under its bar; "second long name" would run into it there.
		const scene = lay([
			{ name: "first", segments: [[100, 110]], color: "#000001" },
			{ name: "second long name", segments: [[130, 140]], color: "#000002" },
		]);
		const [boxed] = rects(scene);
		expect(rects(scene)).toHaveLength(1);
		expect(boxed).toMatchObject({ fill: "#000002", stroke: "#000001" });
		expect(boxed.y + boxed.height).toBeLessThan(-1.3);
		const name = label(scene, "second long name");
		expect(overlap(box(name), edges(boxed))).toBe(true);
		const [leader] = lines(scene, "#7f7f7f");
		expect(leader.x1).toBeCloseTo(97.2, 9);
		expect(leader).toMatchObject({
			x2: leader.x1,
			y1: -1.3,
			y2: boxed.y + boxed.height,
		});
	});

	test("in a box keeps clear of every other box, and of every leader", () => {
		const crowd = Array.from({ length: 12 }, (_, i) => ({
			name: `feature number ${i}`,
			segments: [[300 + 10 * i, 305 + 10 * i]] as [number, number][],
			color: "#000001",
		}));
		const scene = lay(crowd);
		const boxes = rects(scene);
		expect(boxes.length).toBeGreaterThan(8);
		for (const [i, a] of boxes.entries()) {
			expect(a.y + a.height).toBeLessThan(-1.3);
			for (const b of boxes.slice(i + 1)) {
				expect(overlap(edges(a), edges(b))).toBe(false);
			}
		}
		for (const leader of lines(scene, "#7f7f7f")) {
			const span = {
				left: leader.x1,
				right: leader.x1,
				top: leader.y2,
				bottom: leader.y1,
			};
			const crossed = boxes.filter(
				(b) =>
					b.x < leader.x1 &&
					leader.x1 < b.x + b.width &&
					overlap(span, edges(b)),
			);
			expect(crossed).toEqual([]);
		}
	});

	test("is left out when empty", () => {
		const scene = lay([{ name: "", segments: [[100, 110]], color: "#000001" }]);
		expect(texts(scene, 11.5)).toEqual([]);
	});
});

describe("tiers", () => {
	test("go under the backbone, each bar in the first tier it fits by start", () => {
		const scene = lay([
			{ segments: [[0, 300]], color: "#000001" },
			{ segments: [[302, 400]], color: "#000002" },
			{ segments: [[310, 500]], color: "#000003" },
			{ segments: [[250, 350]], color: "#000004" },
		]);
		const [a, b, c, d] = [1, 2, 3, 4].map((n) => arrows(scene, `#00000${n}`));
		// `b` starts less than three points past `a`'s end; `c` starts more.
		expect(middle(b[0])).toBeGreaterThan(middle(a[0]));
		expect(middle(c[0])).toBe(middle(a[0]));
		// `d` starts before `b`, so it takes the second tier and `b` the third.
		expect(middle(d[0])).toBeGreaterThan(middle(a[0]));
		expect(middle(b[0])).toBeGreaterThan(middle(d[0]));
		expect(middle(a[0])).toBeGreaterThan(0);
	});
});

describe("types_off", () => {
	test("leaves out every feature of a type switched off, source by default", () => {
		const features = [
			{ type: "source", segments: [[0, 1000]], color: "#000001" },
			{ type: "misc_feature", segments: [[0, 100]], color: "#000002" },
		] as Made[];
		const byDefault = lay(features);
		expect(arrows(byDefault, "#000001")).toEqual([]);
		expect(arrows(byDefault, "#000002")).toHaveLength(1);
		const chosen = lay(features, { types_off: ["misc_feature"] });
		expect(arrows(chosen, "#000001")).toHaveLength(1);
		expect(arrows(chosen, "#000002")).toEqual([]);
	});
});

describe("kinds_off", () => {
	test("leaves out every feature, its name and its box when features are off", () => {
		const features = [
			{ name: "lacZ", segments: [[0, 500]], color: "#000001" },
			{ name: "first", segments: [[600, 610]], color: "#000001" },
			{ name: "second long name", segments: [[630, 640]], color: "#000002" },
		] as Made[];
		expect(rects(lay(features))).toHaveLength(1);
		const off = lay(features, { kinds_off: ["features"] });
		expect(off.shapes.filter((s) => s.shape === "polygon")).toEqual([]);
		expect(rects(off)).toEqual([]);
		expect(texts(off, 11.5)).toEqual([]);
	});
});

describe("hidden labels", () => {
	// Two runs of tiny features 70 pt apart along 720 pt: their boxed names stack as one
	// staircase, past the ceiling, and along 1440 pt as two. mbio's line hides the same names.
	const crowd: Made[] = [
		{ name: "lacZ", segments: [[100, 500]], color: "#000002" },
		{ name: "ori", segments: [[300, 301]], color: "#000003" },
		...Array.from({ length: 50 }, (_, i) => {
			const start = i < 25 ? 100 + 6 * i : 341 + 6 * (i - 25);
			return {
				name: `feature number ${i}`,
				segments: [[start, start + 1]] as [number, number][],
				color: "#000001",
			};
		}),
	];

	test("hide the fewest boxed names, longest first, and the rest keep apart under the ceiling", () => {
		const scene = lay(crowd);
		expect(scene.hidden.map((one) => one.name)).toEqual(
			[10, 11, 12, 13, 14, 15, 16, 17].map((i) => `feature number ${i}`),
		);
		const boxes = rects(scene);
		expect(boxes).toHaveLength(42);
		for (const [i, a] of boxes.entries()) {
			expect(a.y).toBeGreaterThanOrEqual(-1.3 - 730);
			for (const b of boxes.slice(i + 1)) {
				expect(overlap(edges(a), edges(b))).toBe(false);
			}
		}
	});

	test("never hide a name inside or under an arrow", () => {
		const scene = lay(crowd);
		expect(label(scene, "lacZ").fill).toBe("#ffffff");
		expect(label(scene, "ori").fill).toBe("#252525");
	});

	test("hide fewer along a longer line, where a name hidden at 720 pt shows", () => {
		const hiddenAt = (width: number) =>
			lay(crowd, {}, {}, width).hidden.map((one) => one.name);
		expect(hiddenAt(720)).toContain("feature number 10");
		expect(hiddenAt(1440)).toEqual([]);
		const wide = lay(crowd, {}, {}, 1440);
		expect(rects(wide)).toHaveLength(50);
		expect(label(wide, "feature number 10")).toBeDefined();
	});
});

describe("the extent", () => {
	test("takes in a label's padded box, not only its text", () => {
		const scene = lay(
			[],
			{},
			{ insertions: [{ name: "a", at: 1000, length: 8 }] },
		);
		const text = box(label(scene, "+8 bp"));
		const { extent } = scene;
		expect(extent.x + extent.width).toBeCloseTo(text.right + 3 + 16, 9);
		expect(extent.y).toBeCloseTo(text.top - 1 - 16, 9);
	});
});
