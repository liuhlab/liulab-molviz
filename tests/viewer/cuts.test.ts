import { describe, expect, test } from "vitest";
import { cutSites } from "../../src/viewer/cuts";
import { layoutLine } from "../../src/viewer/line";
import { checkOptions } from "../../src/viewer/options";
import { check } from "../../src/viewer/record";
import type { Scene, Shape } from "../../src/viewer/scene";
import { measure } from "../../src/viewer/text";
import colourTestFile from "../records/colour-test.json";
import cutAtOriginFile from "../records/n-and-cut-at-origin.json";

/** A record `length` bases long cut by each enzyme at each top-strand cut given. */
function cutBy(
	cuts: [enzyme: string, at: number][],
	{ length = 2686, circular = true } = {},
) {
	return check({
		name: "test",
		circular,
		bases: "A".repeat(length),
		cuts: cuts.map(([enzyme, at]) => ({
			enzyme,
			start: Math.min(at, length - 6),
			end: Math.min(at, length - 6) + 6,
			at,
			stagger: 0,
		})),
	});
}

/** What each site's label says, in order. */
function said(record: ReturnType<typeof cutBy>, enzymes: string[]): string[] {
	return cutSites(record, enzymes).map(({ label }) =>
		label.runs.map((run) => run.text).join(""),
	);
}

describe("cutSites", () => {
	// mbio's `layers.merge_cuts` example, with HincII and HinP1I, whose order depends on case.
	test("labels each position once, its enzymes by name whatever their case, in order", () => {
		const record = cutBy([
			["SacI", 406],
			["BanII", 406],
			["EcoRI", 396],
			["HinP1I", 900],
			["HincII", 900],
		]);
		expect(
			said(record, ["SacI", "BanII", "EcoRI", "HinP1I", "HincII"]),
		).toEqual(["EcoRI (396)", "BanII - SacI (406)", "HincII - HinP1I (900)"]);
	});

	test("numbers a site by the base before the cut, the last base on a circle cut at its origin", () => {
		const circle = cutBy([["EcoRI", 0]], { length: 48 });
		expect(said(circle, ["EcoRI"])).toEqual(["EcoRI (48)"]);
		const line = cutBy(
			[
				["EcoRI", 0],
				["BsaI", 48],
			],
			{ length: 48, circular: false },
		);
		expect(said(line, ["EcoRI", "BsaI"])).toEqual(["EcoRI (0)", "BsaI (48)"]);
	});

	test("sets the name of an enzyme that cuts the record once in bold, and the rest regular", () => {
		const record = cutBy([
			["SacI", 406],
			["BanII", 406],
			["BanII", 1000],
			["KpnI", 412],
		]);
		const runs = cutSites(record, ["BanII", "SacI", "KpnI"]).map(
			({ label }) => label.runs,
		);
		expect(runs).toEqual([
			[
				{ text: "BanII - ", face: "sans" },
				{ text: "SacI", face: "sans-bold" },
				{ text: " (406)", face: "sans" },
			],
			[
				{ text: "KpnI", face: "sans-bold" },
				{ text: " (412)", face: "sans" },
			],
			[{ text: "BanII (1000)", face: "sans" }],
		]);
	});

	test("takes every cut of each enzyme named, whatever its case, and ignores a name with none", () => {
		const record = cutBy([
			["EcoRI", 396],
			["BsmBI", 3],
			["BsmBI", 45],
		]);
		expect(said(record, ["bsmbi", "NotI"])).toEqual([
			"BsmBI (3)",
			"BsmBI (45)",
		]);
	});

	test("names a site as a hidden label: its enzymes, its point, its fewest cuts", () => {
		const record = cutBy([
			["BsmBI", 3],
			["Esp3I", 3],
			["BsmBI", 45],
			["Esp3I", 45],
			["Esp3I", 900],
			["EcoRI", 396],
		]);
		const [site] = cutSites(record, ["BsmBI", "Esp3I"]);
		expect(site.at).toBe(3);
		expect(site.label).toMatchObject({
			kind: "cuts",
			name: "BsmBI - Esp3I",
			at: 3,
			fewestCuts: 2,
		});
		expect(site.label).not.toHaveProperty("spans");
	});
});

type Line = Extract<Shape, { shape: "line" }>;
type Text = Extract<Shape, { shape: "text" }>;

function drawn(record: ReturnType<typeof check>, options: object = {}): Scene {
	return layoutLine(record, checkOptions(options, record));
}

/** The leaders, left to right. */
function leaders(scene: Scene): Line[] {
	return scene.shapes
		.filter((s): s is Line => s.shape === "line" && s.stroke === "#7f7f7f")
		.sort((a, b) => a.x1 - b.x1);
}

function labelTexts(scene: Scene): Text[] {
	return scene.shapes.filter(
		(s): s is Text => s.shape === "text" && s.size === 11.5,
	);
}

describe("a cut site on the line", () => {
	// Where mbio's line sets a lone cut site's label: on a leader from -1.3 to -11.3.
	test("is a label on a leader from the backbone's top at the cut, with no mark of its own", () => {
		const record = cutBy([["EcoRI", 500]], { length: 1000, circular: false });
		const scene = drawn(record);
		const [leader] = leaders(scene);
		expect(leaders(scene)).toHaveLength(1);
		expect(leader).toMatchObject({ x1: 360, x2: 360, y1: -1.3 });
		expect(leader.y2).toBeCloseTo(-11.3, 9);
		const [name, number] = labelTexts(scene);
		expect(name).toMatchObject({
			text: "EcoRI",
			face: "sans-bold",
			x: 363,
			fill: "#000000",
		});
		expect(number).toMatchObject({ text: " (500)", face: "sans" });
		expect(number.x).toBeCloseTo(363 + measure("EcoRI", "sans-bold", 11.5), 9);
		expect(
			scene.shapes.filter((s) => s.shape !== "line" && s.shape !== "text"),
		).toEqual([]);
	});

	test("lies in the span at either end of it", () => {
		const record = cutBy(
			[
				["EcoRI", 100],
				["BamHI", 200],
				["PstI", 300],
			],
			{ length: 1000, circular: false },
		);
		const scene = drawn(record, { span: { start: 100, end: 200 } });
		expect(leaders(scene).map((l) => l.x1)).toEqual([0, 720]);
	});

	test("on a circle drawn whole lies at the right end when it cuts at the origin", () => {
		const record = check(cutAtOriginFile);
		const scene = drawn(record, { kinds_off: ["features"] });
		expect(leaders(scene).map((l) => l.x1)).toEqual([720]);
		const said = labelTexts(scene).map((t) => t.text);
		expect(said).toEqual(["EcoRI", " (48)"]);
	});

	test("lies past the origin in a span across it", () => {
		const record = check(colourTestFile);
		const scene = drawn(record, {
			span: { start: 2600, end: 2750 },
			enzymes: ["BsmBI"],
			kinds_off: ["features"],
		});
		// BsmBI cuts at 3 and 45, so at 2689 and 2731 as the span counts.
		expect(leaders(scene).map((l) => l.x1)).toEqual([427.2, 628.8]);
	});
});
