// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { drawFigure } from "../../src/viewer/draw";
import {
	prepare,
	prepareViews,
	stackedViews,
	svg,
} from "../../src/viewer/drawing";
import {
	checkFigure,
	figureSvg,
	prepareFigure,
	prepareFigureFile,
} from "../../src/viewer/figure";

import { FormatError } from "../../src/viewer/format";
import { rowPages } from "../../src/viewer/pages";
import { DIM, INK } from "../../src/viewer/paint";
import { check } from "../../src/viewer/record";
import {
	leftEdge,
	moved,
	type Scene,
	type Shape,
} from "../../src/viewer/scene";
import { height, measure, metrics } from "../../src/viewer/text";
import ap1 from "../records/ap1-product.json";

/** A linear record `length` bases long, with one CDS called `feature` near its start. */
function record(name: string, length: number, feature: string) {
	return {
		name,
		circular: false,
		bases: "ACGT".repeat(length / 4),
		features: [
			{
				name: feature,
				type: "CDS",
				strand: 1,
				segments: [{ start: 10, end: 60 }],
			},
		],
	};
}

const first = record("round 1", 100, "lacZ");
const second = record("round 2", 200, "GFP");

describe("checkFigure", () => {
	test("returns each record checked, in order", () => {
		expect(checkFigure([first, second])).toEqual([check(first), check(second)]);
	});

	test.each<[string, unknown, string[]]>([
		["records that are not a list", first, ["records: must be a list"]],
		["no record", [], ["records: must hold at least one record"]],
		[
			"a bad record, by its place",
			[first, { ...second, bases: "" }, { ...first, circular: 1 }],
			[
				"records[1].bases: must hold at least one base",
				"records[2].circular: must be true or false",
			],
		],
	])("rejects %s", (_, input, expected) => {
		expect(() => checkFigure(input)).toThrow(
			new FormatError(expected.join("\n")),
		);
	});
});

/** mbio's muted grey, which sets the name above each stacked record. */
const MUTED = "#5c626b";

type Text = Extract<Shape, { shape: "text" }>;

/** The one text shape of `scene` that says `text` in `fill`. */
function said(scene: Scene, text: string, fill: string): Text {
	const found = scene.shapes.filter(
		(s): s is Text => s.shape === "text" && s.text === text && s.fill === fill,
	);
	expect(found).toHaveLength(1);
	return found[0];
}

/** What `shape` is once moved `dy` down, to within rounding. */
function down(shape: Shape, dy: number): unknown {
	const near = (y: number) => expect.closeTo(y + dy, 9);
	switch (shape.shape) {
		case "line":
			return { ...shape, y1: near(shape.y1), y2: near(shape.y2) };
		case "polygon":
			return { ...shape, points: shape.points.map(([x, y]) => [x, near(y)]) };
		case "circle":
			return { ...shape, cy: near(shape.cy) };
		case "path":
			return moved(shape, 0, dy);
		case "rect":
		case "text":
			return { ...shape, y: near(shape.y) };
	}
}

/** Rows of 20 bases, so each record's sequence view runs to more than one PDF page. */
const viewed = {
	span: { start: 0, end: 100 },
	sequence_view: true,
	bases_per_row: 20,
};

describe("prepareFigure", () => {
	const options = { span: { start: 0, end: 100 } };

	test.each([
		["its map", options],
		["its map with its sequence view under it", viewed],
	])(
		"stacks the records in order, each as it draws alone moved down only: %s",
		(_, options) => {
			const figure = prepareFigure([first, second], options);
			const [top, bottom] = [first, second].map((r) =>
				stackedViews(prepareViews(r, options)),
			);
			const drawn = figure.shapes.filter(
				(s) => !("fill" in s && s.fill === MUTED),
			);
			expect(drawn.slice(0, top.shapes.length)).toEqual(top.shapes);
			const dy =
				said(figure, "round 2", INK).y - said(bottom, "round 2", INK).y;
			expect(dy).toBeGreaterThan(top.extent.height);
			expect(drawn.slice(top.shapes.length)).toEqual(
				bottom.shapes.map((s) => down(s, dy)),
			);
		},
	);

	test("sets each name above its record at the left edge, 12 points under the record before", () => {
		const figure = prepareFigure([first, second], options);
		const [top, bottom] = [first, second].map((r) => prepare(r, options));
		const dy = said(figure, "round 2", INK).y - said(bottom, "round 2", INK).y;
		const [above, below] = ["round 1", "round 2"].map((name) => {
			const text = said(figure, name, MUTED);
			expect(text).toMatchObject({ face: "sans-bold", size: 13.5 });
			const width = measure(text.text, text.face, text.size);
			const y = text.y - metrics(text.face).ascent * text.size;
			return {
				x: leftEdge(text, width),
				y,
				height: height(text.face, text.size),
			};
		});
		const margin = 16;
		expect(figure.extent.y).toBeCloseTo(above.y - margin, 9);
		expect(above.x).toBeCloseTo(figure.extent.x + margin, 9);
		expect(below.x).toBeCloseTo(figure.extent.x + margin, 9);
		expect(above.y + above.height).toBeLessThanOrEqual(top.extent.y);
		expect(below.y).toBeCloseTo(top.extent.y + top.extent.height + 12, 9);
		expect(below.y + below.height).toBeLessThanOrEqual(bottom.extent.y + dy);
		expect(figure.extent.y + figure.extent.height).toBeCloseTo(
			bottom.extent.y + bottom.extent.height + dy,
			9,
		);
	});

	test("lights a name in the record that has it, dims the other whole, and moves nothing", () => {
		const records = [first, second];
		const lit = prepareFigure(records, { ...options, highlight: ["LACZ"] });
		const arrows = lit.shapes.flatMap((s) =>
			s.shape === "polygon" ? [s.fill] : [],
		);
		expect(arrows).toEqual(["#77aadd", DIM]);
		const unpainted = (scene: Scene) =>
			scene.shapes.map((s) => ({ ...s, fill: null, stroke: null }));
		expect(unpainted(lit)).toEqual(unpainted(prepareFigure(records, options)));
	});
});

describe("prepareFigureFile", () => {
	test("has no pages of its own when no record draws its sequence view", () => {
		const options = { span: { start: 0, end: 100 } };
		expect(prepareFigureFile([first, second], options)).toEqual({
			scene: prepareFigure([first, second], options),
			pages: null,
		});
	});

	test("puts the maps on page 1, as the figure draws them without the sequence view", () => {
		const { pages } = prepareFigureFile([first, second], viewed);
		const maps = prepareFigure([first, second], {
			...viewed,
			sequence_view: false,
		});
		expect(pages?.[0]).toMatchObject({
			extent: maps.extent,
			shapes: maps.shapes,
		});
	});

	test("then each record's rows in record order, the first page of each under its name", () => {
		const { pages } = prepareFigureFile([first, second], viewed);
		const rows = [first, second].map((r) => {
			const { sequence } = prepareViews(r, viewed);
			return sequence ? rowPages(sequence) : [];
		});
		expect(rows.every((own) => own.length > 1)).toBe(true);
		expect(pages).toHaveLength(1 + rows.flat().length);
		let at = 1;
		for (const [i, [plain, ...rest]] of rows.entries()) {
			const page = pages?.[at] as Scene;
			const name = said(page, [first, second][i].name, MUTED);
			expect(name).toMatchObject({ face: "sans-bold", size: 13.5 });
			const top = name.y - metrics(name.face).ascent * name.size;
			const margin = 16;
			expect(leftEdge(name, 0)).toBeCloseTo(plain.extent.x + margin, 9);
			expect(top + height(name.face, name.size)).toBeLessThanOrEqual(
				plain.extent.y,
			);
			expect(page.extent.y).toBeCloseTo(top - margin, 9);
			expect(page.extent.y + page.extent.height).toBe(
				plain.extent.y + plain.extent.height,
			);
			expect(page.shapes.filter((s) => s !== name)).toEqual(plain.shapes);
			expect(pages?.slice(at + 1, at + 1 + rest.length)).toEqual(rest);
			at += 1 + rest.length;
		}
	});
});

describe("figureSvg", () => {
	test.each([
		{ span: { start: 20, end: 90 }, highlight: ["lacZ"] },
		{ ...viewed, highlight: ["lacZ"] },
	])(
		"draws one record exactly as svg does, its PDF pages too: %o",
		(options) => {
			expect(figureSvg([first], options)).toEqual(svg(first, options));
		},
	);

	test("joins what each record hid, in order, in one notice, and keeps each record's own", () => {
		const every = { enzymes: [...new Set(ap1.cuts.map((cut) => cut.enzyme))] };
		const records = [ap1, first, ap1];
		const drawn = figureSvg(records, every);
		const alone = [...Array(4).fill("BtgZI"), ...Array(2).fill("BspQI - SapI")];
		expect(drawn.hidden.map(({ kind, name }) => [kind, name])).toEqual(
			[...alone, ...alone].map((name) => ["cuts", name]),
		);
		expect(drawn.notice).toBe("12 cut sites are hidden");
		const notices = prepareFigure(records, every).shapes.filter(
			(s) => s.shape === "text" && s.text === "6 cut sites are hidden",
		);
		expect(notices).toHaveLength(2);
	});

	test.each<[string, unknown, unknown, string[]]>([
		[
			"a bad record before any option",
			[first, { ...second, bases: "" }],
			{ bogus: 1 },
			["records[1].bases: must hold at least one base"],
		],
		[
			"a problem every record has, once",
			[first, second],
			{ bogus: 1, highlight: ["lacZ", "SacI"] },
			[
				"options.highlight[1]: names nothing in any record",
				"options.bogus: unknown key",
			],
		],
		[
			"a span past one record's end, naming that record",
			[first, second],
			{ span: { start: 0, end: 150 } },
			[
				"options.span.end (records[0]): must be at most the record's length, 100",
			],
		],
	])("rejects %s", (_, records, options, expected) => {
		expect(() => figureSvg(records, options)).toThrow(
			new FormatError(expected.join("\n")),
		);
	});
});

describe("drawFigure", () => {
	afterEach(() => {
		document.head.replaceChildren();
		document.body.replaceChildren();
	});

	test("puts one still SVG in the element, the names as text, and destroy removes it", () => {
		const element = document.createElement("div");
		document.body.append(element);
		const drawing = drawFigure(element, [first, second], {});
		expect(element.children).toHaveLength(1);
		const svg = element.children[0];
		expect(svg.tagName.toLowerCase()).toBe("svg");
		const texts = [...svg.querySelectorAll("text")].map((t) => t.textContent);
		expect(
			texts.filter((t) => t === "round 1" || t === "round 2"),
		).toHaveLength(4);
		drawing.destroy();
		expect(element.children).toHaveLength(0);
	});

	test("throws a FormatError on a bad record, adding nothing to the page", () => {
		const element = document.createElement("div");
		expect(() =>
			drawFigure(element, [first, { ...second, bases: "" }]),
		).toThrow(new FormatError("records[1].bases: must hold at least one base"));
		expect(element.children).toHaveLength(0);
		expect(document.querySelectorAll("style")).toHaveLength(0);
	});
});
