import { describe, expect, test } from "vitest";
import { layoutCircle } from "../../src/viewer/circle";
import { gelSvg, plateSvg, prepare, svg } from "../../src/viewer/drawing";
import { FormatError } from "../../src/viewer/format";
import { layout } from "../../src/viewer/line";
import { checkOptions } from "../../src/viewer/options";
import { check } from "../../src/viewer/record";
import { leftEdge } from "../../src/viewer/scene";
import { measure, metrics } from "../../src/viewer/text";

const good = { name: "p", circular: false, bases: "ACGT".repeat(25) };

describe("svg", () => {
	test("checks the record", () => {
		expect(() => svg({ ...good, bases: "" }, {})).toThrow(
			new FormatError("bases: must hold at least one base"),
		);
	});

	test("checks the options against the record", () => {
		expect(() => svg(good, { span: { start: 0, end: 101 } })).toThrow(
			new FormatError(
				"options.span.end: must be at most the record's length, 100",
			),
		);
	});

	test("lays a whole circular record out as the circle, or as the line when asked", () => {
		const circular = check({ ...good, circular: true });
		expect(prepare(circular, {})).toStrictEqual(
			layoutCircle(circular, checkOptions({}, circular)),
		);
		expect(prepare(circular, { map: "line" })).toStrictEqual(
			layout(circular, checkOptions({ map: "line" }, circular)),
		);
	});

	test("sizes the drawing with no unit, so one unit is one point", () => {
		const root = /^<svg\b[^>]*>/.exec(svg(good).svg)?.[0] ?? "";
		const size = (name: string) =>
			Number(new RegExp(`\\s${name}="([^"]*)"`).exec(root)?.[1]);
		expect(size("width")).toBeGreaterThan(0);
		expect(size("height")).toBeGreaterThan(0);
	});

	test("draws the line, as the only page, hiding nothing", () => {
		const drawn = svg({
			...good,
			features: [
				{
					name: "orf",
					type: "CDS",
					strand: 1,
					segments: [{ start: 10, end: 60 }],
				},
			],
		});
		expect(drawn.svg).toContain('fill="#77aadd"');
		expect(drawn.pages).toEqual([drawn.svg]);
		expect(drawn.hidden).toEqual([]);
		expect(drawn.notice).toBe("");
	});

	test("draws a crowded line's notice at its bottom right, and returns what hid with it", () => {
		// Two runs of tiny features whose boxed names stack past the ceiling as one staircase.
		const crowded = {
			...good,
			bases: "ACGT".repeat(250),
			features: Array.from({ length: 50 }, (_, i) => {
				const start = i < 25 ? 100 + 6 * i : 341 + 6 * (i - 25);
				return {
					name: `feature number ${i}`,
					type: "misc_feature",
					strand: 1,
					segments: [{ start, end: start + 1 }],
				};
			}),
		};
		const drawn = svg(crowded);
		expect(drawn.notice).toBe("8 features are hidden");
		expect(drawn.hidden.map((one) => one.name)).toEqual(
			[10, 11, 12, 13, 14, 15, 16, 17].map((i) => `feature number ${i}`),
		);
		expect(drawn.hidden[0]).toEqual({
			kind: "features",
			name: "feature number 10",
			spans: [{ start: 160, end: 161 }],
		});
		const { extent, shapes } = prepare(crowded, {});
		const said = shapes.flatMap((s) =>
			s.shape === "text" && s.text === drawn.notice ? [s] : [],
		);
		expect(said).toHaveLength(1);
		const [text] = said;
		const width = measure(text.text, text.face, text.size);
		const margin = 16;
		expect(leftEdge(text, width) + width).toBeCloseTo(
			extent.x + extent.width - margin,
			9,
		);
		expect(text.y + metrics(text.face).descent * text.size).toBeCloseTo(
			extent.y + extent.height - margin,
			9,
		);
	});

	test("counts a label placed twice as hidden only when neither placement shows", () => {
		// A primer across the origin of a whole circle is labelled at both ends: once in a stack
		// one label too tall, where it hides first, and once alone.
		const record = {
			...good,
			circular: true,
			bases: "ACGT".repeat(250),
			primers: [
				{
					name: "across",
					bases: "A".repeat(10),
					sites: [{ start: 995, end: 1005, strand: 1 }],
				},
			],
			insertions: Array.from({ length: 41 }, () => ({
				name: "",
				at: 990,
				length: 3,
			})),
		};
		const drawn = svg(record, { map: "line" });
		expect(drawn.hidden).toEqual([]);
		expect(drawn.notice).toBe("");
		const said = prepare(record, { map: "line" }).shapes.filter(
			(s) => s.shape === "text" && s.text === "across (996 .. 5)",
		);
		expect(said).toHaveLength(1);
	});
});

describe("gelSvg", () => {
	const gel = {
		ladder: { name: "ladder", bands: [100, 1000] },
		lanes: [{ name: "GFP", bands: [741] }],
	};

	test("checks the gel", () => {
		expect(() => gelSvg({ ...gel, lanes: [{ name: "GFP" }] })).toThrow(
			new FormatError("lanes[0].bands: missing"),
		);
	});

	test("draws the gel, every letter an outline, as the only page, hiding nothing", () => {
		const drawn = gelSvg(gel);
		expect(drawn.svg).toMatch(/^<svg\b/);
		expect(drawn.svg).toContain('fill="#15171c"');
		expect(drawn.svg).not.toContain("<text");
		expect(drawn.svg).not.toContain("<title");
		expect(drawn.pages).toEqual([drawn.svg]);
		expect(drawn.hidden).toEqual([]);
		expect(drawn.notice).toBe("");
	});
});

describe("plateSvg", () => {
	const plate = { rows: 2, columns: 3, wells: { A1: "water" } };

	test("checks the plate", () => {
		expect(() => plateSvg({ ...plate, wells: { C1: "water" } })).toThrow(
			new FormatError("wells.C1: not on the plate, which runs A1 to B3"),
		);
	});

	test("draws the plate, every letter an outline, as the only page, hiding nothing", () => {
		const drawn = plateSvg(plate);
		expect(drawn.svg).toMatch(/^<svg\b/);
		expect(drawn.svg).toContain('fill="#3f90da"');
		expect(drawn.svg).not.toContain("<text");
		expect(drawn.svg).not.toContain("<title");
		expect(drawn.pages).toEqual([drawn.svg]);
		expect(drawn.hidden).toEqual([]);
		expect(drawn.notice).toBe("");
	});
});
