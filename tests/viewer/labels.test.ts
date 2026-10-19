import { describe, expect, test } from "vitest";
import {
	hidingOrder,
	type Kind,
	type Label,
	notice,
	noticeShapes,
} from "../../src/viewer/labels";
import { leftEdge } from "../../src/viewer/scene";
import { measure, metrics } from "../../src/viewer/text";

/** A hidden label of `kind` named `name`. */
function hid(kind: Kind, name = "x") {
	return { kind, name, spans: [] };
}

/** A label of `kind` that says `text` in one run. */
function label(
	kind: Kind,
	text: string,
	{ cuts = 0, dim = false } = {},
): Label {
	return {
		kind,
		name: text,
		spans: [],
		runs: [{ text, face: "sans" }],
		color: "#000000",
		dim,
		cuts,
	};
}

function said(labels: readonly Label[]): string[] {
	return labels.map((one) => one.runs.map((run) => run.text).join(""));
}

describe("hidingOrder", () => {
	// mbio's `layers.hiding` example.
	test("hides the sites of the enzyme that cuts most first, then the longer label", () => {
		const sites = [
			label("cuts", "EcoRI (396)", { cuts: 1 }),
			label("cuts", "BsmBI (3)", { cuts: 2 }),
			label("cuts", "BsmBI (45)", { cuts: 2 }),
		];
		expect(said(sites.sort(hidingOrder))).toEqual([
			"BsmBI (45)",
			"BsmBI (3)",
			"EcoRI (396)",
		]);
	});

	test("hides cut sites, primers, features, then insertions, and a dimmed label first", () => {
		const labels = [
			label("insertions", "+25 bp"),
			label("features", "lacZ"),
			label("primers", "M13 fwd (1 .. 17)"),
			label("cuts", "EcoRI (396)", { cuts: 1 }),
			label("insertions", "+3 bp", { dim: true }),
		];
		expect(said(labels.sort(hidingOrder))).toEqual([
			"+3 bp",
			"EcoRI (396)",
			"M13 fwd (1 .. 17)",
			"lacZ",
			"+25 bp",
		]);
	});
});

describe("noticeShapes", () => {
	test("draws nothing when no label hid", () => {
		expect(noticeShapes([], 700, 100)).toEqual([]);
	});

	test("sets the notice under the bottom right corner, listing each hidden label on hover", () => {
		const hidden = [
			label("cuts", "EcoRI (396)", { cuts: 1 }),
			label("primers", "M13 fwd (1 .. 17)"),
		];
		const shapes = noticeShapes(hidden, 700, 100);
		expect(shapes).toHaveLength(1);
		const [text] = shapes;
		expect(text).toMatchObject({
			shape: "text",
			text: "1 enzyme site and 1 primer are hidden",
			face: "sans",
			size: 10.5,
			hover: "EcoRI (396)\nM13 fwd (1 .. 17)",
		});
		if (text.shape !== "text") throw new Error("not text");
		const left = leftEdge(text, measure(text.text, "sans", 10.5));
		expect(left + measure(text.text, "sans", 10.5)).toBeCloseTo(700, 9);
		expect(text.y - metrics("sans").ascent * 10.5).toBeCloseTo(110, 9);
	});
});

describe("notice", () => {
	// The wording is mbio's `layers.notice`.
	test.each<[string, Kind[], string]>([
		["nothing when none hid", [], ""],
		["one label with is", ["cuts"], "1 enzyme site is hidden"],
		[
			"two kinds joined by and",
			["primers", "cuts", "cuts", "cuts"],
			"3 enzyme sites and 1 primer are hidden",
		],
		[
			"every kind in the order labels hide",
			["insertions", "features", "features", "primers", "cuts"],
			"1 enzyme site, 1 primer, 2 features and 1 insertion are hidden",
		],
	])("says %s", (_, kinds, said) => {
		expect(notice(kinds.map((kind) => hid(kind)))).toBe(said);
	});
});
