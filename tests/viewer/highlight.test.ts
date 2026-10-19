/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import type { MapScene } from "../../src/viewer/labels";
import { layoutLine } from "../../src/viewer/line";
import { answersTo, checkOptions } from "../../src/viewer/options";
import { check } from "../../src/viewer/record";
import type { Shape } from "../../src/viewer/scene";

const records = import.meta.glob("../records/*.json", {
	eager: true,
	import: "default",
});

/** mbio's grey for everything a highlight leaves unlit, and an outline of it darkened. */
const DIM = "#dddddd";
const DIM_OUTLINE = "#636363";

/** A feature on the forward strand, in its own colour. */
function feature(name: string, segments: [number, number][], color: string) {
	return {
		name,
		type: "misc_feature",
		strand: 1,
		color,
		segments: segments.map(([start, end]) => ({ start, end })),
	};
}

/**
 * A linear record of 1000 bases with each feature's name in a different place: `Lit` and
 * `inside` inside their arrows, `under` under its arrow, and `joined` boxed above the line.
 */
const RECORD = {
	name: "test",
	circular: false,
	bases: "ACGT".repeat(250),
	features: [
		feature("Lit", [[100, 400]], "#000080"),
		feature("inside", [[500, 800]], "#000080"),
		feature("under", [[900, 960]], "#77aadd"),
		feature(
			"a joined feature",
			[
				[20, 40],
				[60, 80],
			],
			"#ee8866",
		),
	],
};

function lay(record: unknown, options: object = {}): MapScene {
	const checked = check(record);
	return layoutLine(checked, checkOptions(options, checked));
}

type Text = Extract<Shape, { shape: "text" }>;

/** The fill of the one text shape that says `text`. */
function fill(scene: MapScene, text: string): string {
	const found = scene.shapes.filter(
		(s): s is Text => s.shape === "text" && s.text === text,
	);
	expect(found).toHaveLength(1);
	return found[0].fill;
}

/** Each fill and stroke of the shapes of one sort, `rect` or `polygon`. */
function paints(scene: MapScene, sort: "rect" | "polygon"): string[][] {
	return scene.shapes.flatMap((s) =>
		s.shape === sort ? [[s.fill, s.stroke]] : [],
	);
}

/** Where each shape of `scene` is and what it says, its paints left out, and the extent. */
function geometry({ extent, shapes }: MapScene) {
	const unpainted = shapes.map((shape) =>
		Object.entries(shape).filter(([key]) => key !== "fill" && key !== "stroke"),
	);
	return { extent, unpainted };
}

describe("a highlight", () => {
	test("dims every paint of an unlit feature to one grey, and keeps a lit one's", () => {
		const plain = lay(RECORD);
		const lit = lay(RECORD, { highlight: ["LIT"] });
		expect(paints(lit, "polygon")).toEqual([
			["#000080", "#00003a"],
			[DIM, DIM_OUTLINE],
			[DIM, DIM_OUTLINE],
			[DIM, DIM_OUTLINE],
			[DIM, DIM_OUTLINE],
		]);
		expect(paints(lit, "rect")).toEqual([[DIM, DIM_OUTLINE]]);
		// Text inside a grey arrow or box is black, as on any light fill; a name under one is grey.
		expect(fill(lit, "Lit")).toBe("#ffffff");
		expect(fill(lit, "inside")).toBe("#000000");
		expect(fill(lit, "a joined feature")).toBe("#000000");
		expect(fill(lit, "under")).toBe(DIM);
		const gaps = (scene: MapScene) =>
			scene.shapes.flatMap((s) =>
				s.shape === "line" && s.strokeWidth === 1.5 ? [s.stroke] : [],
			);
		expect(gaps(plain)).toEqual(["#666666"]);
		expect(gaps(lit)).toEqual([DIM]);
	});

	test("lights or dims a feature across a linear record's end whole, both bars and joins", () => {
		const record = {
			...RECORD,
			features: [
				feature("Lit", [[100, 400]], "#000080"),
				feature(
					"across",
					[
						[900, 960],
						[20, 50],
					],
					"#ee8866",
				),
			],
		};
		// The arrows' fills and the joins' strokes, sorted.
		const paintsOf = (scene: MapScene) =>
			scene.shapes
				.flatMap((s) =>
					s.shape === "polygon"
						? [s.fill]
						: s.shape === "line" && s.strokeWidth === 1.5
							? [s.stroke]
							: [],
				)
				.sort();
		expect(paintsOf(lay(record, { highlight: ["ACROSS"] }))).toEqual([
			"#666666",
			"#666666",
			DIM,
			"#ee8866",
			"#ee8866",
		]);
		expect(paintsOf(lay(record, { highlight: ["Lit"] }))).toEqual([
			"#000080",
			DIM,
			DIM,
			DIM,
			DIM,
		]);
	});

	test("dims an unlit primer, cut site and insertion, and keeps their leaders", () => {
		const record = {
			...RECORD,
			primers: [
				{
					name: "p1",
					bases: "A".repeat(20),
					sites: [{ start: 420, end: 440, strand: 1 }],
				},
			],
			cuts: [{ enzyme: "EcoRI", start: 445, end: 451, at: 446, stagger: 4 }],
			insertions: [{ name: "ins", at: 460, length: 8 }],
		};
		const lit = lay(record, { highlight: ["Lit"] });
		expect(paints(lit, "polygon").at(-1)).toEqual([DIM, DIM_OUTLINE]);
		for (const text of ["p1 (421 .. 440)", "EcoRI", " (446)", "+8 bp"]) {
			expect(fill(lit, text)).toBe(DIM);
		}
		const strokes = (width: number) =>
			lit.shapes.flatMap((s) =>
				s.shape === "line" && s.strokeWidth === width ? [s.stroke] : [],
			);
		// The insertion's bar, then a leader to each label.
		expect(strokes(2)).toEqual([DIM]);
		expect(new Set(strokes(0.8))).toEqual(new Set(["#7f7f7f"]));
		expect(strokes(0.8)).toHaveLength(4);
	});

	test("lights every cut site naming an enzyme it names, whatever its case", () => {
		const cut = (enzyme: string, at: number) => ({
			enzyme,
			start: at,
			end: at + 6,
			at,
			stagger: 0,
		});
		const record = {
			...RECORD,
			cuts: [
				cut("EcoRI", 300),
				cut("EcoRI", 700),
				cut("BanII", 450),
				cut("SacI", 450),
			],
		};
		const lights = (highlight: string[]) => {
			const scene = lay(record, {
				enzymes: ["EcoRI", "BanII", "SacI"],
				highlight,
			});
			return ["EcoRI (300)", "EcoRI (700)", "BanII"].map((text) =>
				fill(scene, text),
			);
		};
		expect(lights(["ecori"])).toEqual(["#000000", "#000000", DIM]);
		expect(lights(["SACI"])).toEqual([DIM, DIM, "#000000"]);
	});

	test("lights a primer and an insertion by name, whatever its case", () => {
		const record = {
			...RECORD,
			primers: [
				{
					name: "p1",
					bases: "A".repeat(20),
					sites: [{ start: 420, end: 440, strand: 1 }],
				},
			],
			insertions: [{ name: "ins", at: 460, length: 8 }],
		};
		const lit = lay(record, { highlight: ["P1", "INS"] });
		const primer = (scene: MapScene) => paints(scene, "polygon").at(-1);
		expect(primer(lit)).toEqual(primer(lay(record)));
		expect(primer(lit)?.[0]).toBe("#aa3377");
		expect(fill(lit, "p1 (421 .. 440)")).toBe("#aa3377");
		expect(fill(lit, "+8 bp")).toBe("#cc3311");
		expect(fill(lit, "Lit")).toBe("#000000");
	});

	// The line draws no read or disagreement, so nothing on a trace record dims.
	const dimmable = Object.entries(records).filter(
		([path]) => !path.includes("/trace-"),
	);

	test.each(dimmable)("moves nothing in %s", (_, record) => {
		const [name, ...others] = answersTo(check(record));
		const plain = lay(record);
		const lit = lay(record, { highlight: [name] });
		const dimmed = lit.shapes.some((s) => "fill" in s && s.fill === DIM);
		expect(dimmed).toBe(others.length > 0);
		expect(geometry(lit)).toEqual(geometry(plain));
	});
});

/** A cut by `enzyme` at `at`, its site the six bases from the base before. */
function cut(enzyme: string, at: number) {
	return { enzyme, start: at - 1, end: at + 5, at, stagger: 4 };
}

/** A primer site from `start` to `end` on `strand`. */
function primer(name: string, start: number, end: number, strand: number) {
	return {
		name,
		bases: "A".repeat(end - start),
		sites: [{ start, end, strand }],
	};
}

// A stack too tall for the ceiling: 40 enzymes cutting once, a base apart, Twice, which cuts in
// the stack and again at 100, four primers, two features too tiny for their names, and an
// insertion.
const CROWD = {
	...RECORD,
	features: [
		feature("tiny A", [[520, 522]], "#77aadd"),
		feature("tiny B", [[530, 532]], "#77aadd"),
	],
	primers: [
		primer("p1-F", 505, 525, 1),
		primer("p2-R", 510, 530, -1),
		primer("p3-F", 515, 535, 1),
		primer("p4-R", 520, 540, -1),
	],
	insertions: [{ name: "barcode", at: 535, length: 8 }],
	cuts: [
		...Array.from({ length: 40 }, (_, i) => cut(`E${i + 1}`, 500 + i)),
		cut("Twice", 541),
		cut("Twice", 100),
	],
};
const EVERY = [...new Set(CROWD.cuts.map(({ enzyme }) => enzyme))];
const PRIMERS = ["p1-F", "p2-R", "p3-F", "p4-R"];

describe("in a crowd with every enzyme, labels hide", () => {
	test.each<[string, string[], [string, string, number][]]>([
		[
			"cut sites first, the most frequent cutter first",
			[],
			[
				["cuts", "Twice", 541],
				["cuts", "E10", 509],
				["cuts", "E11", 510],
				["cuts", "E12", 511],
				["cuts", "E13", 512],
				["cuts", "E14", 513],
				["cuts", "E15", 514],
			],
		],
		[
			"unlit primers, features and the insertion before lit cut sites, and a lit primer last",
			[...EVERY, "p1-F"],
			[
				["primers", "p2-R", 510],
				["primers", "p3-F", 515],
				["primers", "p4-R", 520],
				["features", "tiny A", 520],
				["features", "tiny B", 530],
				["insertions", "barcode", 535],
				["cuts", "Twice", 541],
			],
		],
		[
			"an unlit feature, then an unlit insertion, then lit cut sites",
			[...EVERY, ...PRIMERS, "tiny A"],
			[
				["features", "tiny B", 530],
				["insertions", "barcode", 535],
				["cuts", "Twice", 541],
				["cuts", "E10", 509],
				["cuts", "E11", 510],
				["cuts", "E12", 511],
				["cuts", "E13", 512],
			],
		],
	])("%s", (_, highlight, hidden) => {
		const scene = lay(CROWD, { enzymes: EVERY, highlight });
		expect(
			scene.hidden.map((one) => [
				one.kind,
				one.name,
				"at" in one ? one.at : one.spans[0].start,
			]),
		).toEqual(hidden);
	});
});
