import { describe, expect, test } from "vitest";
import type { FormatError } from "../../src/viewer/format";
import { checkGel, layoutGel } from "../../src/viewer/gel";
import { leftEdge, type Scene, type Shape } from "../../src/viewer/scene";
import { measure } from "../../src/viewer/text";
import longNames from "../gels/long-names.json";
import oneSize from "../gels/one-size.json";
import pcrTest from "../gels/pcr-test-expected-bands.json";
import digests from "../gels/restriction-digests.json";

const good = {
	title: "PCR products",
	ladder: { name: "NEB 100 bp DNA Ladder (N3231)", bands: [100, 200, 300] },
	lanes: [
		{ name: "GFP", bands: [741] },
		{ name: "empty vector", bands: [] },
	],
};

describe("checkGel", () => {
	test("returns a good gel as it is given", () => {
		expect(checkGel(good)).toStrictEqual(good);
	});

	test.each<[string, object]>([
		["with no title", { ladder: good.ladder, lanes: good.lanes }],
		["with no lanes", { ...good, lanes: [] }],
		[
			"with an empty title and empty names",
			{
				title: "",
				ladder: { name: "", bands: [100] },
				lanes: [{ name: "", bands: [] }],
			},
		],
	])("takes a gel %s", (_, gel) => {
		expect(checkGel(gel)).toStrictEqual(gel);
	});

	test.each<[string, unknown, string[]]>([
		["a gel that is not an object", null, ["gel: must be an object"]],
		["a gel that is a list", [1], ["gel: must be an object"]],
		[
			"a lane that is a list",
			{ ...good, lanes: [[741]] },
			["lanes[0]: must be an object"],
		],
		[
			"a gel with no ladder and no lanes",
			{},
			["ladder: missing", "lanes: missing"],
		],
		[
			"a title that is not text",
			{ ...good, title: 7 },
			["title: must be text"],
		],
		[
			"lanes that are not a list",
			{ ...good, lanes: good.lanes[0] },
			["lanes: must be a list"],
		],
		[
			"a lane whose bands are left out",
			{ ...good, lanes: [{ name: "GFP" }] },
			["lanes[0].bands: missing"],
		],
		[
			"keys the format does not have, at every level",
			{
				...good,
				colour: "red",
				ladder: { ...good.ladder, marker: true },
				lanes: [{ name: "GFP", bands: [741], label: "GFP" }],
			},
			[
				"ladder.marker: unknown key",
				"lanes[0].label: unknown key",
				"colour: unknown key",
			],
		],
		[
			"a gel in mbio's own keys",
			{
				ladder: { name: "L", bands_bp: [100] },
				lanes: [{ label: "GFP", bands_bp: [741] }],
			},
			[
				"ladder.bands: missing",
				"ladder.bands_bp: unknown key",
				"lanes[0].name: missing",
				"lanes[0].bands: missing",
				"lanes[0].label: unknown key",
				"lanes[0].bands_bp: unknown key",
			],
		],
		[
			"a ladder with no band",
			{ ...good, ladder: { name: "none", bands: [] } },
			["ladder.bands: must hold at least one band"],
		],
		[
			"a band of 0 bp, part of a bp, or not a number",
			{ ...good, ladder: { name: "L", bands: [0, 1.5, "100"] } },
			[
				"ladder.bands[0]: must be 1 or more",
				"ladder.bands[1]: must be an integer",
				"ladder.bands[2]: must be a number",
			],
		],
		[
			"a lane's band below 1 bp",
			{ ...good, lanes: [{ name: "GFP", bands: [741, -741] }] },
			["lanes[0].bands[1]: must be 1 or more"],
		],
	])("rejects %s", (_, input, expected) => {
		expect(problems(input)).toEqual(expected);
	});
});

/** The lines of the error checking `input` throws, or none. */
function problems(input: unknown): string[] {
	try {
		checkGel(input);
		return [];
	} catch (error) {
		return (error as FormatError).message.split("\n");
	}
}

// mbio's gel colours.
const GEL = "#15171c";
const BAND = "#f3f0ff";
const LADDER = "#a9bbff";
const WELL = "#030407";

type Rect = Extract<Shape, { shape: "rect" }>;
type Text = Extract<Shape, { shape: "text" }>;

/** A gel of `ladder` and a lane for each of `lanes`, every name made up. */
function lay(ladder: number[], lanes: number[][] = []): Scene {
	return layoutGel(
		checkGel({
			ladder: { name: "ladder", bands: ladder },
			lanes: lanes.map((bands, i) => ({ name: `lane ${i + 1}`, bands })),
		}),
	);
}

function rects(scene: Scene, fill: string): Rect[] {
	return scene.shapes.filter(
		(s): s is Rect => s.shape === "rect" && s.fill === fill,
	);
}

function texts(scene: Scene): Text[] {
	return scene.shapes.filter((s): s is Text => s.shape === "text");
}

/** The texts under the gel. */
function under(scene: Scene): Text[] {
	const [ground] = rects(scene, GEL);
	return texts(scene).filter((t) => t.y > ground.y + ground.height);
}

/** The legend under the gel, a list of its texts for each line, left to right. */
function legend(scene: Scene): string[][] {
	const lines = new Map<number, Text[]>();
	for (const t of under(scene)) lines.set(t.y, [...(lines.get(t.y) ?? []), t]);
	return [...lines.entries()]
		.sort(([a], [b]) => a - b)
		.map(([, line]) => line.sort((a, b) => a.x - b.x).map((t) => t.text));
}

function middle(rect: Rect): number {
	return rect.y + rect.height / 2;
}

describe("layoutGel", () => {
	test("sets each band linear in the log of its size, over the ladder and lanes together", () => {
		const scene = lay([100, 1000], [[10, 10000]]);
		const [ground] = rects(scene, GEL);
		const [small, large] = rects(scene, BAND)
			.map(middle)
			.sort((a, b) => a - b)
			.reverse();
		const [hundred, thousand] = rects(scene, LADDER)
			.map(middle)
			.sort((a, b) => b - a);
		// mbio's run, down from the gel's top.
		expect(large - ground.y).toBeCloseTo(26);
		expect(small - large).toBeCloseTo(210);
		expect(ground.y + ground.height - small).toBeCloseTo(16);
		expect(thousand - large).toBeCloseTo(210 / 3);
		expect(hundred - large).toBeCloseTo((2 * 210) / 3);
	});

	test("sets every band in the middle of the run when all are one size", () => {
		const scene = layoutGel(checkGel(oneSize));
		const [ground] = rects(scene, GEL);
		const bands = [...rects(scene, LADDER), ...rects(scene, BAND)];
		expect(bands).toHaveLength(4);
		for (const band of bands) {
			expect(middle(band) - ground.y).toBeCloseTo(26 + 210 / 2);
		}
	});

	test("marks the ladder L and numbers the lanes from 1, each over its well", () => {
		const scene = lay([100], [[200], [], [300]]);
		const [ground] = rects(scene, GEL);
		const marks = texts(scene).filter((t) => t.y < ground.y);
		expect(marks.map((t) => t.text)).toEqual(["L", "1", "2", "3"]);
		const wells = rects(scene, WELL).map((w) => w.x + w.width / 2);
		expect(marks.map((t) => t.x)).toEqual(wells);
		expect(marks.every((t) => t.anchor === "middle")).toBe(true);
		expect(marks.every((t) => t.face === "sans-bold")).toBe(true);
	});

	test("labels the ladder's sizes down the left, leaving out one too close to the one above", () => {
		const scene = lay([100, 990, 1000], [[]]);
		const [ground] = rects(scene, GEL);
		const labels = texts(scene).filter(
			(t) => t.x < ground.x && t.y > ground.y && t.y < ground.y + ground.height,
		);
		expect(labels.map((t) => t.text)).toEqual(["1000", "100"]);
		const rights = labels.map((t) => t.x + measure(t.text, t.face, t.size));
		expect(rights[0]).toBeCloseTo(rights[1]);
		expect(rights[0]).toBeLessThan(ground.x);
		const bands = rects(scene, LADDER).map(middle);
		for (const [i, label] of labels.entries()) {
			const band = i === 0 ? Math.min(...bands) : Math.max(...bands);
			expect(label.y).toBeGreaterThan(band);
			expect(label.y - label.size).toBeLessThan(band);
		}
	});

	test("gives the ladder's name in the legend, then each lane's name with its sizes, or no band", () => {
		expect(legend(layoutGel(checkGel(pcrTest)))).toEqual([
			["L", "1 kb ladder"],
			["1", "Sample: 500 bp"],
			["2", "No template: no band"],
		]);
		expect(legend(layoutGel(checkGel(digests)))).toEqual([
			["L", "NEB 1 kb Plus DNA Ladder (N3200)"],
			["1", "pUC19: 2684, 2 bp"],
			["2", "GFP amplicon: 719 bp"],
		]);
	});

	test("wraps a long title, and each legend line at a hanging indent, inside the margins", () => {
		const scene = layoutGel(checkGel(longNames));
		for (const t of texts(scene)) {
			const width = measure(t.text, t.face, t.size);
			const from = leftEdge(t, width);
			expect(from).toBeGreaterThanOrEqual(10);
			expect(from + width).toBeLessThanOrEqual(scene.extent.width - 10);
		}
		const title = texts(scene).filter((t) => t.size === 13);
		expect(title.length).toBeGreaterThan(1);
		expect(title.every((t) => t.face === "sans-bold")).toBe(true);
		expect(title.map((t) => t.text).join(" ")).toBe(longNames.title);

		const lines = under(scene).filter((t) => t.face === "sans");
		expect(new Set(lines.map((t) => t.x)).size).toBe(1);
		// Each entry's lines: a line with a mark starts one, and a line of text alone carries it on.
		const entries: string[][] = [];
		for (const line of legend(scene)) {
			if (line.length === 2) entries.push([line[1]]);
			else entries[entries.length - 1].push(...line);
		}
		const long = longNames.lanes[2];
		expect(entries[3].length).toBeGreaterThan(1);
		expect(entries[3].join("").replaceAll(" ", "")).toBe(
			`${long.name}: ${long.bands[0]} bp`.replaceAll(" ", ""),
		);
	});

	test("draws no title for a gel with none", () => {
		expect(texts(lay([100])).filter((t) => t.size === 13)).toEqual([]);
	});

	test("is at least 240 wide, and wider when the gel needs it", () => {
		expect(lay([100], [[200]]).extent.width).toBe(240);
		const wide = lay([100], Array(12).fill([200]));
		const [ground] = rects(wide, GEL);
		expect(wide.extent.width).toBeGreaterThan(240);
		expect(wide.extent.width).toBeCloseTo(ground.x + ground.width + 10);
	});

	test("centres a narrow gel with its sizes and marks, and keeps the title and legend at the left", () => {
		const scene = layoutGel(
			checkGel({
				title: "A gel",
				ladder: { name: "ladder", bands: [100, 1000] },
				lanes: [{ name: "lane 1", bands: [200] }],
			}),
		);
		const [ground] = rects(scene, GEL);
		const sizes = texts(scene).filter(
			(t) => t.x < ground.x && t.y > ground.y && t.y < ground.y + ground.height,
		);
		const blockLeft = Math.min(...sizes.map((t) => t.x));
		const blockRight = ground.x + ground.width;
		expect(scene.extent.width).toBe(240);
		expect(blockLeft).toBeGreaterThan(10);
		expect(blockLeft).toBeCloseTo(scene.extent.width - blockRight);
		const marks = texts(scene).filter((t) => t.y < ground.y && t.size === 10);
		const wells = rects(scene, WELL).map((w) => w.x + w.width / 2);
		expect(marks.map((t) => t.x)).toEqual(wells);
		const title = texts(scene).filter((t) => t.size === 13);
		expect(title.map((t) => t.x)).toEqual([10]);
		expect(Math.min(...under(scene).map((t) => t.x))).toBe(10);
	});

	test("leaves a gel wider than 240 at the left margin", () => {
		const scene = layoutGel(checkGel(longNames));
		const [ground] = rects(scene, GEL);
		const sizes = texts(scene).filter(
			(t) => t.x < ground.x && t.y > ground.y && t.y < ground.y + ground.height,
		);
		expect(scene.extent.width).toBeGreaterThan(240);
		expect(Math.min(...sizes.map((t) => t.x))).toBeCloseTo(10);
		expect(scene.extent.width - (ground.x + ground.width)).toBeCloseTo(10);
	});
});
