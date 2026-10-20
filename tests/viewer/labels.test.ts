import { describe, expect, test } from "vitest";
import { prepare } from "../../src/viewer/drawing";
import {
	disagreementLabel,
	type Hidden,
	hidingOrder,
	type Label,
	type LabelKind,
	labelShapes,
	labelSize,
	notice,
	noticeShapes,
	readLabel,
} from "../../src/viewer/labels";
import { check } from "../../src/viewer/record";
import { leftEdge } from "../../src/viewer/scene";
import { measure, metrics } from "../../src/viewer/text";
import backbone from "../records/puc19-backbone-amplicon.json";

/** A hidden label of `kind` named `name`, at the record's start. */
function hid(kind: LabelKind, name = "x"): Hidden {
	return kind === "cuts" || kind === "insertions"
		? { kind, name, at: 0 }
		: { kind, name, spans: [] };
}

/** A label of `kind` that says `text` in one run. */
function label(
	kind: LabelKind,
	text: string,
	{ fewestCuts = 0, dim = false } = {},
): Label {
	return {
		...hid(kind, text),
		runs: [{ text, face: "sans" }],
		color: "#000000",
		dim,
		fewestCuts,
		tip: text,
	};
}

function said(labels: readonly Label[]): string[] {
	return labels.map((one) => one.runs.map((run) => run.text).join(""));
}

describe("hidingOrder", () => {
	// mbio's `layers.hiding` example.
	test("hides the sites of the enzyme that cuts most first, then the longer label", () => {
		const sites = [
			label("cuts", "EcoRI (396)", { fewestCuts: 1 }),
			label("cuts", "BsmBI (3)", { fewestCuts: 2 }),
			label("cuts", "BsmBI (45)", { fewestCuts: 2 }),
		];
		expect(said(sites.sort(hidingOrder))).toEqual([
			"BsmBI (45)",
			"BsmBI (3)",
			"EcoRI (396)",
		]);
	});

	test("hides cut sites, primers, reads, features, insertions, then disagreements, and a dimmed label first", () => {
		const labels = [
			label("disagreements", "696 A>G"),
			label("insertions", "+25 bp"),
			label("features", "lacZ"),
			label("reads", "r1 (1 .. 900)"),
			label("primers", "M13 fwd (1 .. 17)"),
			label("cuts", "EcoRI (396)", { fewestCuts: 1 }),
			label("disagreements", "12 C>T", { dim: true }),
		];
		expect(said(labels.sort(hidingOrder))).toEqual([
			"12 C>T",
			"EcoRI (396)",
			"M13 fwd (1 .. 17)",
			"r1 (1 .. 900)",
			"lacZ",
			"+25 bp",
			"696 A>G",
		]);
	});
});

describe("noticeShapes", () => {
	test("draws nothing when no label hid", () => {
		expect(noticeShapes([], 700, 100)).toEqual([]);
	});

	test("sets the notice under the bottom right corner, listing each hidden label on hover", () => {
		const hidden = [
			label("cuts", "EcoRI (396)", { fewestCuts: 1 }),
			label("primers", "M13 fwd (1 .. 17)"),
		];
		const shapes = noticeShapes(hidden, 700, 100);
		expect(shapes).toHaveLength(1);
		const [text] = shapes;
		expect(text).toMatchObject({
			shape: "text",
			text: "1 cut site and 1 primer are hidden",
			face: "sans",
			size: 10.5,
			title: "EcoRI (396)\nM13 fwd (1 .. 17)",
			tip: "1 cut site and 1 primer are hidden\nEcoRI (396)\nM13 fwd (1 .. 17)",
		});
		if (text.shape !== "text") throw new Error("not text");
		const left = leftEdge(text, measure(text.text, "sans", 10.5));
		expect(left + measure(text.text, "sans", 10.5)).toBeCloseTo(700, 9);
		expect(text.y - metrics("sans").ascent * 10.5).toBeCloseTo(110, 9);
	});
});

describe("notice", () => {
	// The wording is mbio's `layers.notice`, with the glossary's "cut site".
	test.each<[string, LabelKind[], string]>([
		["nothing when none hid", [], ""],
		["one label with is", ["cuts"], "1 cut site is hidden"],
		[
			"two kinds joined by and",
			["primers", "cuts", "cuts", "cuts"],
			"3 cut sites and 1 primer are hidden",
		],
		[
			"every kind in the order labels hide",
			["insertions", "features", "features", "primers", "cuts"],
			"1 cut site, 1 primer, 2 features and 1 insertion are hidden",
		],
		[
			"a read and a disagreement",
			["disagreements", "reads", "reads", "cuts", "cuts"],
			"2 cut sites, 2 reads and 1 disagreement are hidden",
		],
	])("says %s", (_, kinds, said) => {
		expect(notice(kinds.map((kind) => hid(kind)))).toBe(said);
	});
});

/** A circular record of 1000 bases holding `items`, as a caller hands it over. */
function holding(items: object): object {
	return { name: "test", circular: true, bases: "ACGT".repeat(250), ...items };
}

function feature(name: string, segments: [number, number][]): object {
	return {
		features: [
			{
				name,
				type: "CDS",
				strand: 1,
				segments: segments.map(([start, end]) => ({ start, end })),
			},
		],
	};
}

describe("an item's tip", () => {
	// mbio's hover rows: the name, then the type, the span 1-based and the length.
	test.each<[string, object, string]>([
		[
			"a feature",
			feature("lacZ", [[145, 469]]),
			"lacZ\nCDS\n146 .. 469\n324 bp",
		],
		[
			"a joined feature, each segment's span",
			feature("split", [
				[100, 160],
				[200, 260],
				[300, 360],
			]),
			"split\nCDS\n101 .. 160, 201 .. 260, 301 .. 360\n180 bp",
		],
		[
			"a feature whose segments touch, as one span",
			feature("AmpR", [
				[100, 160],
				[160, 200],
			]),
			"AmpR\nCDS\n101 .. 200\n100 bp",
		],
		[
			"a feature across the origin",
			feature("ori", [[950, 1050]]),
			"ori\nCDS\n951 .. 50\n100 bp",
		],
		[
			"a primer site",
			{
				primers: [
					{
						name: "M13 fwd",
						bases: "A".repeat(17),
						sites: [{ start: 378, end: 395, strand: 1 }],
					},
				],
			},
			"M13 fwd\nprimer\n379 .. 395\n17 bp",
		],
		[
			"a cut site, its enzymes joined",
			{
				cuts: ["SacI", "BanII"].map((enzyme) => ({
					enzyme,
					start: 400,
					end: 406,
					at: 406,
					stagger: -4,
				})),
			},
			"BanII - SacI\ncut site\n406",
		],
		[
			"an insertion",
			{ insertions: [{ name: "ins", at: 12, length: 6 }] },
			"ins\ninsertion\n12^13\n6 bp",
		],
		[
			"a read",
			{ reads: [{ name: "r1", start: 90, end: 110, strand: 1 }] },
			"r1\nread\n91 .. 110\n20 bp",
		],
		[
			"a disagreement over a span",
			{
				disagreements: [
					{ name: "96 A>G", start: 95, end: 96, bases: "G", reads: [] },
				],
			},
			"96 A>G\ndisagreement\n96 .. 96\n1 bp",
		],
	])(
		"of %s is on every shape it draws, on the line and the circle",
		(_, items, tip) => {
			for (const map of ["line", "circle"]) {
				const bare = prepare(holding({}), { map });
				const scene = prepare(holding(items), { map });
				const tipped = scene.shapes.filter((shape) => shape.tip !== undefined);
				expect(tipped.map((shape) => shape.tip)).toEqual(tipped.map(() => tip));
				expect(scene.shapes.length - tipped.length).toBe(bare.shapes.length);
			}
		},
	);

	test("of a feature across a linear record's end gives each segment's span", () => {
		const scene = prepare(backbone, {});
		const tips = new Set(scene.shapes.map((shape) => shape.tip));
		expect(tips).toContain("lacZα\nCDS\n2395 .. 2644, 15 .. 32\n268 bp");
	});
});

describe("the labels of reads and disagreements", () => {
	const record = check({
		name: "p",
		circular: true,
		bases: "ACGT".repeat(25),
		reads: [{ name: "r1", start: 90, end: 110, strand: -1 }],
		disagreements: [
			{ name: "96 A>G", start: 95, end: 96, bases: "G", reads: ["r1"] },
			{ name: "ins", at: 0, bases: "TT", reads: ["r1"], color: "#CC3311" },
		],
	});
	const bounds = { length: 100, circular: true };
	const [read] = record.reads;
	const [span, point] = record.disagreements;

	test("a read's says its name and the bases it spans, in a primer's colour", () => {
		expect(readLabel(read, 100, [])).toMatchObject({
			kind: "reads",
			name: "r1",
			spans: [{ start: 90, end: 110 }],
			runs: [{ text: "r1 (91 .. 10)", face: "sans" }],
			color: "#aa3377",
			dim: false,
		});
	});

	test("a disagreement's says its name, grey without a colour, its hover where it lies", () => {
		expect(disagreementLabel(span, bounds, [])).toMatchObject({
			label: {
				kind: "disagreements",
				name: "96 A>G",
				spans: [{ start: 95, end: 96 }],
				runs: [{ text: "96 A>G", face: "sans" }],
				color: "#bbbbbb",
			},
			hover: "96 A>G · 96 .. 96",
		});
		expect(disagreementLabel(point, bounds, [])).toMatchObject({
			label: { kind: "disagreements", name: "ins", at: 0, color: "#cc3311" },
			hover: "ins · 100^1",
		});
	});

	test("each dims unless the highlight names it", () => {
		const others = ["ins"];
		expect(readLabel(read, 100, others)).toMatchObject({
			dim: true,
			color: "#dddddd",
		});
		expect(disagreementLabel(span, bounds, others).label.dim).toBe(true);
		expect(disagreementLabel(point, bounds, others).label.dim).toBe(false);
	});

	test("a disagreement's over a span is boxed, as a feature's name is, and at a point is text", () => {
		const drawn = (label: Label) =>
			labelShapes(label, { x: 0, y: 0, ...labelSize(label) }).map((shape) => [
				shape.shape,
				"fill" in shape ? shape.fill : undefined,
			]);
		expect(drawn(disagreementLabel(span, bounds, []).label)).toEqual([
			["rect", "#bbbbbb"],
			["text", "#000000"],
		]);
		expect(drawn(disagreementLabel(point, bounds, []).label)).toEqual([
			["text", "#cc3311"],
		]);
	});
});
