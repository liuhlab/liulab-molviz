import { describe, expect, test } from "vitest";
import { checkOptions } from "../../../src/viewer/format/options";
import { check } from "../../../src/viewer/format/record";
import { layoutLine } from "../../../src/viewer/map/line";
import type { MapScene, Scene, Shape } from "../../../src/viewer/scene";
import { measure } from "../../../src/viewer/text/text";
import verifiedFile from "../../records/puc19-gfp-verification.json";

function lay(record: unknown, options: object = {}): MapScene {
	const checked = check(record);
	return layoutLine(checked, checkOptions(options, checked));
}

type Polygon = Extract<Shape, { shape: "polygon" }>;
type Text = Extract<Shape, { shape: "text" }>;
type Line = Extract<Shape, { shape: "line" }>;

function polygons(scene: Scene, fill: string): Polygon[] {
	return scene.shapes.filter(
		(s): s is Polygon => s.shape === "polygon" && s.fill === fill,
	);
}

/** Where `p` reaches left and right, and up and down. */
function edges(p: Polygon): { xs: number[]; ys: number[] } {
	const xs = p.points.map(([x]) => x);
	const ys = p.points.map(([, y]) => y);
	return {
		xs: [Math.min(...xs), Math.max(...xs)],
		ys: [Math.min(...ys), Math.max(...ys)],
	};
}

function text(scene: Scene, said: string): Text {
	const found = scene.shapes.filter(
		(s): s is Text => s.shape === "text" && s.text === said,
	);
	expect(found).toHaveLength(1);
	return found[0];
}

/** Where `t` starts, whatever its anchor. */
function start(t: Text): number {
	const wide = measure(t.text, t.face, t.size);
	return t.anchor === "middle" ? t.x - wide / 2 : t.x;
}

function closeTo(values: readonly number[], expected: readonly number[]) {
	expect(values).toHaveLength(expected.length);
	for (const [i, value] of values.entries()) {
		expect(value).toBeCloseTo(expected[i], 2);
	}
}

describe("pUC19-GFP's close-up of 696 A>G", () => {
	// mbio's committed verification page draws these numbers for the same window and highlight.
	const scene = lay(verifiedFile, {
		span: { start: 665, end: 726 },
		kinds_off: ["cuts"],
		highlight: ["696 A>G", "consensus.fasta"],
	});

	test("draws GFP dimmed in the first tier, the disagreement's bar in its colour in the next", () => {
		const [gfp] = polygons(scene, "#dddddd");
		closeTo(edges(gfp).xs, [0, 720]);
		closeTo(edges(gfp).ys, [33.32, 48.32]);
		const [bar] = polygons(scene, "#cc3311");
		expect(bar.stroke).toBe("#5c1708");
		closeTo(edges(bar).xs, [354.1, 365.9]);
		closeTo(edges(bar).ys, [60.32, 75.32]);
	});

	test("names the disagreement under its bar", () => {
		const name = text(scene, "696 A>G");
		expect(start(name)).toBeCloseTo(333.99, 2);
		expect(name.y).toBeCloseTo(91, 2);
		expect(name.fill).toBe("#252525");
	});

	test("draws the read as a band with no heads in the primers' first row, labelled as a primer", () => {
		const [read] = polygons(scene, "#aa3377");
		expect(read.points).toHaveLength(4);
		closeTo(edges(read).xs, [0, 720]);
		closeTo(edges(read).ys, [-8.37, -4.37]);
		const label = text(scene, "consensus.fasta (1 .. 3347)");
		expect(start(label)).toBeCloseTo(363, 2);
		expect(label.y).toBeCloseTo(-23.15, 2);
		expect(label.fill).toBe("#aa3377");
	});
});

/** A linear record's bases. */
const BASES = "ACGT".repeat(250);

function record(more: object) {
	return {
		name: "test",
		circular: false,
		bases: BASES,
		reads: [{ name: "r1", start: 0, end: 1000, strand: 1 }],
		...more,
	};
}

/** A disagreement over `start` .. `end`, or at `at`, that the read `r1` shows. */
function disagreement(
	name: string,
	where: { start: number; end: number } | { at: number },
	color?: string,
) {
	return { name, ...where, bases: "A", reads: ["r1"], ...(color && { color }) };
}

describe("a disagreement", () => {
	test("over a span with no colour is mbio's grey, and one grey darker when dimmed", () => {
		const made = record({
			disagreements: [disagreement("d", { start: 500, end: 501 })],
		});
		expect(polygons(lay(made), "#bbbbbb")).toHaveLength(1);
		const dimmed = lay(made, { highlight: ["r1"] });
		expect(polygons(dimmed, "#bbbbbb")).toEqual([]);
		const bars = polygons(dimmed, "#dddddd").filter((p) => edges(p).ys[0] > 0);
		expect(bars).toHaveLength(1);
	});

	test("over a span is drawn whatever feature types are off", () => {
		const made = record({
			features: [
				{
					name: "f",
					type: "misc_feature",
					strand: 1,
					segments: [{ start: 100, end: 200 }],
				},
			],
			disagreements: [disagreement("d", { start: 500, end: 501 }, "#cc3311")],
		});
		const scene = lay(made, { types_off: ["misc_feature", ""] });
		expect(polygons(scene, "#cc3311")).toHaveLength(1);
		expect(text(scene, "d").fill).toBe("#252525");
	});

	test("at a point is a bar across both strands in its colour, labelled with its name", () => {
		const made = record({
			disagreements: [
				disagreement("insertion after 500", { at: 500 }, "#ee7733"),
			],
		});
		const scene = lay(made);
		const [mark] = scene.shapes.filter(
			(s): s is Line => s.shape === "line" && s.stroke === "#ee7733",
		);
		expect(mark).toMatchObject({ x1: 360, x2: 360, strokeWidth: 2 });
		expect(mark.y1).toBeCloseTo(-2.8);
		expect(mark.y2).toBeCloseTo(6.6);
		expect(mark.title).toBe("insertion after 500 · 500^501");
		const label = text(scene, "insertion after 500");
		expect(label.fill).toBe("#ee7733");
		expect(scene.shapes.filter((s) => s.shape === "rect")).toEqual([]);
	});

	test("is left out, bar, mark and label, when disagreements are off", () => {
		const made = record({
			disagreements: [
				disagreement("over", { start: 500, end: 501 }, "#cc3311"),
				disagreement("at", { at: 700 }, "#cc3311"),
			],
		});
		const scene = lay(made, { kinds_off: ["disagreements"] });
		const red = scene.shapes.filter(
			(s) =>
				("fill" in s && s.fill === "#cc3311") ||
				("stroke" in s && s.stroke === "#cc3311"),
		);
		expect(red).toEqual([]);
		expect(polygons(scene, "#aa3377")).toHaveLength(1);
	});
});

describe("a read", () => {
	/** The middle height of each arrow filled in the primers' colour, by its left end. */
	function rows(scene: Scene): [number, number][] {
		return polygons(scene, "#aa3377")
			.map((p): [number, number] => {
				const { xs, ys } = edges(p);
				return [Math.round(xs[0]), (ys[0] + ys[1]) / 2];
			})
			.sort((a, b) => a[0] - b[0]);
	}

	test("shares the primers' rows, packed with their sites by start", () => {
		const made = record({
			primers: [
				{
					name: "p",
					bases: "ACGTACGTAC",
					sites: [
						{ start: 100, end: 110, strand: 1 },
						{ start: 350, end: 360, strand: -1 },
					],
				},
			],
			reads: [
				{ name: "beside", start: 200, end: 300, strand: 1 },
				{ name: "over", start: 340, end: 500, strand: -1 },
			],
		});
		const [first, beside, second, over] = rows(lay(made));
		expect(beside[1]).toBe(first[1]);
		expect(second[1]).toBe(first[1]);
		// One row above is 8.13 points higher, as for primers.
		expect(over[1]).toBeCloseTo(first[1] - 8.13, 2);
	});

	test("on the bottom strand has its head at its start", () => {
		const made = record({
			reads: [{ name: "back", start: 200, end: 300, strand: -1 }],
		});
		const [arrow] = polygons(lay(made), "#aa3377");
		const { ys } = edges(arrow);
		const tips = arrow.points
			.filter(([, y]) => Math.abs(y - (ys[0] + ys[1]) / 2) < 1e-9)
			.map(([x]) => x);
		expect(tips).toEqual([144]);
	});

	test("is left out, with its label, when reads are off", () => {
		const scene = lay(record({}), { kinds_off: ["reads"] });
		expect(polygons(scene, "#aa3377")).toEqual([]);
		expect(
			scene.shapes.filter((s) => s.shape === "text" && s.size === 11.5),
		).toEqual([]);
	});
});

describe("hiding", () => {
	// Forty-five points stack their labels past the ceiling at one place. The two spans share a
	// tier, too close for their names under it, so theirs are boxed above.
	const crowd = record({
		reads: [{ name: "r1", start: 490, end: 510, strand: 1 }],
		insertions: [{ name: "ins", at: 500, length: 3 }],
		disagreements: [
			disagreement("s", { start: 490, end: 491 }),
			disagreement("a disagreement over a span", { start: 509, end: 510 }),
			...Array.from({ length: 45 }, (_, i) =>
				disagreement(`d${i}`, { at: 500 }),
			),
		],
	});

	test("hides a read before an insertion, and a disagreement last, each as the record writes it", () => {
		const { hidden } = lay(crowd);
		expect(hidden.slice(0, 3)).toEqual([
			{ kind: "reads", name: "r1", spans: [{ start: 490, end: 510 }] },
			{ kind: "insertions", name: "ins", at: 500 },
			{
				kind: "disagreements",
				name: "a disagreement over a span",
				spans: [{ start: 509, end: 510 }],
			},
		]);
		const rest = hidden.slice(3);
		expect(rest).toContainEqual({
			kind: "disagreements",
			name: "d10",
			at: 500,
		});
		expect(rest.filter((one) => one.kind !== "disagreements")).toEqual([]);
	});
});
