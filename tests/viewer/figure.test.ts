// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { type Layout, rowPages } from "../../src/viewer/drawing";
import { checkFigure, figureInput } from "../../src/viewer/figure";
import { FormatError } from "../../src/viewer/format/format";
import { check } from "../../src/viewer/format/record";
import { drawFigure, figureSvg, svg } from "../../src/viewer/index";
import { DIM, INK } from "../../src/viewer/paint";
import {
	leftEdge,
	moved,
	type Scene,
	type Shape,
} from "../../src/viewer/scene";
import { height, measure, metrics } from "../../src/viewer/text/text";
import { prepare, prepareViews, stackedViews } from "../../src/viewer/views";
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
/** The two records made circular, so that drawn whole each opens on the circle. */
const [firstRing, secondRing] = [first, second].map((one) => ({
	...one,
	circular: true,
}));

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

/** `value` with each number in it matched to within rounding. */
function near(value: unknown): unknown {
	if (typeof value === "number") return expect.closeTo(value, 9);
	if (Array.isArray(value)) return value.map(near);
	if (typeof value === "object" && value !== null) {
		return Object.fromEntries(
			Object.entries(value).map(([key, one]) => [key, near(one)]),
		);
	}
	return value;
}

/** What `shape` is once moved `dx` right and `dy` down, to within rounding. */
function shifted(shape: Shape, dx: number, dy: number): unknown {
	return near(moved(shape, dx, dy));
}

/** Rows of 20 bases, so each record's sequence view runs to more than one PDF page. */
const viewed = {
	span: { start: 0, end: 100 },
	sequence_view: true,
	bases_per_row: 20,
};

/** `records` checked and laid out as a figure with `options`, as a file draws them. */
function laidOut(records: unknown, options: unknown): Layout {
	return figureInput.layout(checkFigure(records), options, { page: false });
}

/** The scene of `records` laid out as a figure with `options`. */
function figureScene(records: unknown, options: unknown): Scene {
	return laidOut(records, options).scene;
}

describe("the figure's layout", () => {
	const options = { span: { start: 0, end: 100 } };

	test.each([
		["lines", [first, second], options],
		["lines with their sequence views", [first, second], viewed],
		["circles, their centres one above the other", [firstRing, secondRing], {}],
	])(
		"stacks the records in order, each as it draws alone moved down only: %s",
		(_, records, options) => {
			const figure = figureScene(records, options);
			const [top, bottom] = records.map((r) =>
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
				bottom.shapes.map((s) => shifted(s, 0, dy)),
			);
		},
	);

	test("centres a circle on the lines it stacks with, which keep their x", () => {
		const figure = figureScene([firstRing, second], {});
		const [top, bottom] = [firstRing, second].map((r) => prepare(r, {}));
		const drawn = figure.shapes.filter(
			(s) => !("fill" in s && s.fill === MUTED),
		);
		const middle = bottom.extent.x + bottom.extent.width / 2;
		expect(drawn.slice(0, top.shapes.length)).toEqual(
			top.shapes.map((s) => shifted(s, middle, 0)),
		);
		const dy = said(figure, "round 2", INK).y - said(bottom, "round 2", INK).y;
		expect(drawn.slice(top.shapes.length)).toEqual(
			bottom.shapes.map((s) => shifted(s, 0, dy)),
		);
	});

	test("sets each name above its record at the left edge, 12 points under the record before", () => {
		const figure = figureScene([first, second], options);
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
		const lit = figureScene(records, { ...options, highlight: ["LACZ"] });
		const arrows = lit.shapes.flatMap((s) =>
			s.shape === "polygon" ? [s.fill] : [],
		);
		expect(arrows).toEqual(["#77aadd", DIM]);
		const unpainted = (scene: Scene) =>
			scene.shapes.map((s) => ({ ...s, fill: null, stroke: null }));
		expect(unpainted(lit)).toEqual(unpainted(figureScene(records, options)));
	});
});

describe("the figure's PDF pages", () => {
	test("has no pages of its own when no record draws its sequence view", () => {
		const options = { span: { start: 0, end: 100 } };
		expect(laidOut([first, second], options).pages).toBeNull();
	});

	test("puts the maps on page 1, as the figure draws them without the sequence view", () => {
		const { pages } = laidOut([first, second], viewed);
		const maps = figureScene([first, second], {
			...viewed,
			sequence_view: false,
		});
		expect(pages?.[0]).toMatchObject({
			extent: maps.extent,
			shapes: maps.shapes,
		});
	});

	test("then each record's rows in record order, the first page of each under its name", () => {
		const { pages } = laidOut([first, second], viewed);
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
		["a line", first, { span: { start: 20, end: 90 }, highlight: ["lacZ"] }],
		[
			"a line with its sequence view",
			first,
			{ ...viewed, highlight: ["lacZ"] },
		],
		["a circle", firstRing, {}],
	])(
		"draws one record exactly as svg does, its PDF pages too: %s",
		(_, record, options) => {
			expect(figureSvg([record], options)).toEqual(svg(record, options));
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
		const notices = figureScene(records, every).shapes.filter(
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
		[
			"a sequence view past 100,000 bases, as a page would leave out",
			[{ ...first, bases: "ACGT".repeat(25_001) }],
			{ sequence_view: true },
			[
				"options.sequence_view: must be false past 100,000 bases, and the span holds 100,004",
			],
		],
		[
			"the circle over a span short of one record's whole, naming that record",
			[firstRing, secondRing],
			{ map: "circle", span: { start: 0, end: 100 } },
			[
				'options.map (records[1]): must be "line" when span is not the whole record',
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

	test("leaves the sequence views out past 100,000 bases, with no error", () => {
		const long = { ...first, bases: "ACGT".repeat(25_001) };
		const records = [long, { ...long, name: "round 2" }];
		const element = document.createElement("div");
		drawFigure(element, records, { sequence_view: true });
		const alone = document.createElement("div");
		drawFigure(alone, records, {});
		expect(element.innerHTML).toBe(alone.innerHTML);
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
