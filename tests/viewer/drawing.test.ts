import { Window } from "happy-dom";
import { describe, expect, test } from "vitest";
import { type Input, rowPages, stacked } from "../../src/viewer/drawing";
import { figureInput } from "../../src/viewer/figure";
import { FormatError } from "../../src/viewer/format";
import { gelInput } from "../../src/viewer/gel";
import {
	draw,
	drawFigure,
	drawGel,
	drawPlate,
	figureStillSvg,
	figureSvg,
	fontRules,
	gelStillSvg,
	gelSvg,
	plateStillSvg,
	plateSvg,
	stillSvg,
	svg,
} from "../../src/viewer/index";
import { checkOptions } from "../../src/viewer/options";
import { plateInput } from "../../src/viewer/plate";
import { check } from "../../src/viewer/record";
import {
	type Box,
	leftEdge,
	type Scene,
	type Shape,
} from "../../src/viewer/scene";
import { layoutSequence } from "../../src/viewer/sequence";
import { measure, metrics, weights } from "../../src/viewer/text";
import { prepare, recordInput } from "../../src/viewer/views";
import goldenGate from "../gels/golden-gate-pcr-products.json";
import pcrPlate from "../plates/ap1-pcr2-plate.json";
import ap1 from "../records/ap1-product.json";
import primers from "../records/primer-test.json";
import puc19 from "../records/puc19-gfp-product.json";

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

describe("svg with the sequence view", () => {
	const record = { ...good, bases: "ACGT".repeat(500) };
	const drawn = svg(record, { sequence_view: true });
	const size = (text: string) => {
		const root = /^<svg\b[^>]*>/.exec(text)?.[0] ?? "";
		const [width, height] = ["width", "height"].map((name) =>
			Number(new RegExp(`\\s${name}="([^"]*)"`).exec(root)?.[1]),
		);
		return { width, height };
	};

	test("draws the view under the map, centred, as wide as the wider", () => {
		const checked = check(record);
		const view = layoutSequence(
			checked,
			checkOptions({ sequence_view: true }, checked),
		).extent;
		const map = size(svg(record).svg);
		const whole = size(drawn.svg);
		expect(whole.width).toBeCloseTo(Math.max(map.width, view.width), 2);
		expect(whole.height).toBeCloseTo(map.height + view.height, 2);
	});

	test("pages the map alone, then the rows on pages as wide as the view", () => {
		const [map, ...rows] = drawn.pages;
		expect(map).toBe(svg(record).svg);
		expect(rows.length).toBeGreaterThan(1);
		const { width } = size(rows[0]);
		for (const page of rows) {
			expect(size(page).width).toBe(width);
			expect(size(page).height).toBeLessThanOrEqual(width * Math.SQRT2);
		}
	});

	test("hides nothing it would not hide without the view", () => {
		expect(drawn.hidden).toEqual([]);
		expect(drawn.notice).toBe("");
	});

	test("draws a whole circular record's circle above the view, the circle its first page", () => {
		const circular = check({ ...record, circular: true });
		const both = svg(circular, { sequence_view: true });
		const circle = svg(circular);
		expect(both.pages[0]).toBe(circle.svg);
		const view = layoutSequence(
			circular,
			checkOptions({ sequence_view: true }, circular),
		).extent;
		expect(size(both.svg).height).toBeCloseTo(
			size(circle.svg).height + view.height,
			2,
		);
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

/** `given` checked and laid out as `input` with `options`, as a file draws it. */
function fileScene<T>(
	input: Input<T>,
	given: unknown,
	options: unknown = {},
): Scene {
	return input.layout(input.check(given), options, { page: false }).scene;
}

const every = { enzymes: [...new Set(ap1.cuts.map((cut) => cut.enzyme))] };
const line = { ...every, map: "line" };
const view = { sequence_view: true };
const figure = [ap1, primers];

/** The root's opening tag, and each element inside it as written. */
function elements(written: string): { root: string; children: string[] } {
	const root = /^<svg[^>]*>/.exec(written)?.[0] ?? "";
	const inside = written.slice(root.length, -"</svg>".length);
	const children = inside.match(/<(\w+)[^>]*?(?:\/>|>.*?<\/\1>)/gs) ?? [];
	expect(children.join("")).toBe(inside);
	return { root, children };
}

/** The file's root without the namespace its glyph uses name, and its elements but its glyphs. */
function drawnOf(file: string): { root: string; children: string[] } {
	const { root, children } = elements(file);
	return {
		root: root.replace(/ xmlns:xlink="[^"]*"/, ""),
		children: children.filter((element) => !element.startsWith("<defs>")),
	};
}

/**
 * `markup` without its hovers, as a file writes it: no `<title>`, which a still drawing holds, and
 * no hover or item key a live view holds for the page. An element left empty closes itself.
 */
function withoutHovers(markup: string): string {
	return markup
		.replace(/<title>.*?<\/title>/gs, "")
		.replace(/ data-molviz-(hover|item)="[^"]*"/g, "")
		.replace(/^(<\w+[^>]*)><\/\w+>$/, "$1/>");
}

// A record with its sequence view draws live as two SVGs, compared in the block for it below.
const drawings = [
	{
		input: "a record on the line",
		still: stillSvg(ap1, line),
		file: svg(ap1, line),
		scene: fileScene(recordInput, ap1, line),
		live: (element: Element) => draw(element, ap1, line),
	},
	{
		input: "a record on the circle that hides labels",
		still: stillSvg(ap1, every),
		file: svg(ap1, every),
		scene: fileScene(recordInput, ap1, every),
		live: (element: Element) => draw(element, ap1, every),
	},
	{
		input: "a record on the circle, names set along its arcs",
		still: stillSvg(puc19),
		file: svg(puc19),
		scene: fileScene(recordInput, puc19),
		live: (element: Element) => draw(element, puc19),
	},
	{
		input: "a record with its sequence view",
		still: stillSvg(primers, view),
		file: svg(primers, view),
		scene: fileScene(recordInput, primers, view),
		live: undefined,
	},
	{
		input: "a figure of two records",
		still: figureStillSvg(figure, line),
		file: figureSvg(figure, line),
		scene: fileScene(figureInput, figure, line),
		live: (element: Element) => drawFigure(element, figure, line),
	},
	{
		input: "a gel",
		still: gelStillSvg(goldenGate),
		file: gelSvg(goldenGate),
		scene: fileScene(gelInput, goldenGate),
		live: (element: Element) => drawGel(element, goldenGate),
	},
	{
		input: "a plate",
		still: plateStillSvg(pcrPlate),
		file: plateSvg(pcrPlate),
		scene: fileScene(plateInput, pcrPlate),
		live: (element: Element) => drawPlate(element, pcrPlate),
	},
];

test.each(
	drawings.flatMap(({ input, still, live }) =>
		live ? [{ input, still, live }] : [],
	),
)(
	"the still SVG of $input is what the live call draws, once a page parses it",
	({ still, live }) => {
		const { document } = new Window();
		const drawn = document.createElement("div");
		live(drawn as unknown as Element);
		const held = document.createElement("div");
		held.innerHTML = still.svg;
		expect(held.children).toHaveLength(1);
		// The parser keeps the namespace as an attribute too, which draws nothing.
		held.children[0].removeAttribute("xmlns");
		const [ours, theirs] = [held.children[0], drawn.querySelectorAll("svg")[0]];
		if (theirs.querySelector("[data-molviz-hover]")) {
			expect(withoutHovers(ours.outerHTML)).toBe(
				withoutHovers(theirs.outerHTML),
			);
		} else {
			expect(ours.isEqualNode(theirs)).toBe(true);
		}
	},
);

describe.each(drawings)("the still SVG of $input", ({ still, file, scene }) => {
	test("hides what its file hides, with the same notice", () => {
		expect(still.hidden).toEqual(file.hidden);
		expect(still.notice).toBe(file.notice);
	});

	test("lies first on a white ground as large as the drawing", () => {
		const { root, children } = elements(still.svg);
		const [x, y, width, height] =
			/viewBox="([^"]*)"/.exec(root)?.[1].split(" ") ?? [];
		expect(children[0]).toBe(
			`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#ffffff"/>`,
		);
	});

	test("is its file but for the letters and the hovers", () => {
		const ours = elements(still.svg);
		const theirs = drawnOf(file.svg);
		expect(ours.root).toBe(theirs.root);
		expect(ours.children).toHaveLength(theirs.children.length);
		ours.children.forEach((element, i) => {
			if (element.startsWith("<text "))
				expect(theirs.children[i]).toMatch(
					/^<g (?:transform="[^"]*" )?fill="[^"]*"(?:\/>|>(?:<use [^>]*\/>)*<\/g>)$/,
				);
			else expect(withoutHovers(element)).toBe(theirs.children[i]);
		});
	});

	test("holds each text to its measured width or its cells, in the viewer's faces", () => {
		const texts = scene.shapes.flatMap((s) =>
			s.shape === "text" || s.shape === "letters" ? [s] : [],
		);
		const written = [...still.svg.matchAll(/<text ([^>]*)>/g)].map(
			([, attributes]) =>
				Object.fromEntries(
					[...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, n, v]) => [
						n,
						v,
					]),
				),
		);
		expect(written).toHaveLength(texts.length);
		texts.forEach((shape, i) => {
			const { text, face, size } = shape;
			expect(written[i]).toMatchObject({
				"font-family": face === "mono" ? "molviz Mono" : "molviz Sans",
				"font-weight": face === "sans-bold" ? "700" : "400",
			});
			const cell = shape.shape === "text" ? shape.cell : undefined;
			if (shape.shape === "letters") {
				expect(written[i]).not.toHaveProperty("textLength");
				expect(written[i].rotate.split(" ")).toHaveLength([...text].length);
			} else if (cell === undefined) {
				expect(written[i].textLength).toBe(
					measure(text, face, size).toFixed(2),
				);
			} else {
				expect(written[i]).not.toHaveProperty("textLength");
				expect(written[i].x.split(" ")).toHaveLength([...text].length);
			}
		});
	});
});

/** Where an element of a drawing lies; the attributes a move under the map changes. */
const PLACES = ["x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "d", "transform"];

/** What these tests read of a parsed element. */
interface Parsed {
	readonly attributes: ArrayLike<{ name: string; value: string | null }>;
	getAttribute(name: string): string | null;
}

/** Each number of `element`'s attribute `name`, which lists numbers. */
function numbers(element: Parsed, name: string): number[] {
	return (element.getAttribute(name) ?? "").split(" ").map(Number);
}

describe("the still SVG of a record with its sequence view", () => {
	const { document } = new Window();
	const live = document.createElement("div");
	draw(live as unknown as Element, primers, view);
	const [map, sequence] = [...live.querySelectorAll("svg")];
	const held = document.createElement("div");
	held.innerHTML = stillSvg(primers, view).svg;
	const [ground, ...still] = [...held.children[0].children];
	const [, ...mapShapes] = [...map.children];
	// What a live view draws in place of a shape while the bottom strand hides is the page's alone.
	const sequenceShapes = [...sequence.children]
		.slice(1)
		.filter((shape) => !shape.classList.contains("molviz-top"));

	test("is the live map, then the live sequence view moved under it", () => {
		expect(ground.tagName.toLowerCase()).toBe("rect");
		expect(still).toHaveLength(mapShapes.length + sequenceShapes.length);
		mapShapes.forEach((shape, i) => {
			expect(withoutHovers(still[i].outerHTML)).toBe(
				withoutHovers(shape.outerHTML),
			);
		});
		sequenceShapes.forEach((shape, i) => {
			const ours = still[mapShapes.length + i];
			expect(ours.tagName).toBe(shape.tagName);
			expect(ours.textContent).toBe(shape.textContent);
			// A live view's hover, item key and strands are the page's alone.
			const unplaced = (element: Parsed) =>
				Array.from(element.attributes)
					.filter(
						({ name }) =>
							!PLACES.includes(name) &&
							!name.startsWith("data-molviz-") &&
							name !== "class",
					)
					.map(({ name, value }) => [name, value]);
			expect(unplaced(ours)).toEqual(unplaced(shape));
		});
	});

	test("sets its letters as the live view does, every text moved by one step", () => {
		const texts = sequenceShapes.flatMap((shape, i) =>
			shape.tagName.toLowerCase() === "text"
				? [[still[mapShapes.length + i], shape] as const]
				: [],
		);
		expect(
			texts.some(
				([, text]) => text.getAttribute("font-family") === "molviz Mono",
			),
		).toBe(true);
		const [[firstOurs, firstTheirs]] = texts;
		const dx = numbers(firstOurs, "x")[0] - numbers(firstTheirs, "x")[0];
		const dy = numbers(firstOurs, "y")[0] - numbers(firstTheirs, "y")[0];
		for (const [ours, theirs] of texts) {
			const xs = numbers(theirs, "x");
			expect(numbers(ours, "x")).toHaveLength(xs.length);
			numbers(ours, "x").forEach((x, i) => {
				expect(x - xs[i]).toBeCloseTo(dx, 1);
			});
			expect(numbers(ours, "y")[0] - numbers(theirs, "y")[0]).toBeCloseTo(
				dy,
				1,
			);
		}
	});
});

test("a still SVG of a record that hides labels draws the notice", () => {
	expect(stillSvg(ap1, every).notice).not.toBe("");
});

test("a still SVG of the circle sets a name along an arc as real text, a letter at a place", () => {
	const { svg: written } = stillSvg(puc19);
	expect(written).toMatch(/<text [^>]*rotate="[^"]*"[^>]*>[^<]+<\/text>/);
	expect(written).not.toContain("<use ");
});

test("a still SVG draws with no page to draw in", () => {
	expect(typeof document).toBe("undefined");
	expect(gelStillSvg(goldenGate).svg).toMatch(/^<svg /);
});

test.each([
	{
		call: () => stillSvg({ ...good, bases: "" }),
		problem: "bases: must hold at least one base",
	},
	{
		call: () => stillSvg(good, { span: { start: 0, end: 101 } }),
		problem: "options.span.end: must be at most the record's length, 100",
	},
	{
		call: () => stillSvg({ ...good, bases: "ACGT".repeat(25_001) }, view),
		problem:
			"options.sequence_view: must be false past 100,000 bases, and the span holds 100,004",
	},
	{
		call: () =>
			figureStillSvg([{ ...good, bases: "ACGT".repeat(25_001) }], view),
		problem:
			"options.sequence_view: must be false past 100,000 bases, and the span holds 100,004",
	},
	{
		call: () => gelStillSvg({ ...goldenGate, lanes: [{ name: "GFP" }] }),
		problem: "lanes[0].bands: missing",
	},
	{
		call: () => plateStillSvg({ rows: 2, columns: 3, wells: { C1: "water" } }),
		problem: "wells.C1: not on the plate, which runs A1 to B3",
	},
])(
	"a still call throws the input's FormatError: $problem",
	({ call, problem }) => {
		expect(call).toThrow(new FormatError(problem));
	},
);

test("a still SVG writes a name that holds markup as text, in a label and in a hover", () => {
	const name = "</svg><script>&";
	const written = [
		gelStillSvg({
			ladder: { name: "ladder", bands: [100] },
			lanes: [{ name, bands: [100] }],
		}).svg,
		plateStillSvg({ rows: 1, columns: 1, wells: { A1: name } }).svg,
	];
	for (const svg of written) {
		expect(svg).not.toContain("<script");
		const held = new Window().document.createElement("div");
		held.innerHTML = svg;
		expect(held.children).toHaveLength(1);
		const texts = [...held.querySelectorAll("text, title")].map(
			(element) => element.textContent,
		);
		expect(texts.some((text) => text.includes(name))).toBe(true);
	}
});

describe("fontRules", () => {
	const rules = fontRules();

	test("declares each face once, loading it from the rules themselves", () => {
		const faces = Object.keys(weights).length;
		expect(rules.match(/@font-face/g)).toHaveLength(faces);
		const sources = [...rules.matchAll(/url\(([^)]*)\)/g)].map(
			([, url]) => url,
		);
		expect(sources).toHaveLength(faces);
		for (const url of sources) expect(url).toMatch(/^data:/);
	});

	test("are the rules a live drawing declares on its page", () => {
		const { document } = new Window();
		const element = document.createElement("div");
		document.body.append(element);
		draw(element as unknown as Element, puc19);
		expect(document.getElementById("molviz-fonts")?.textContent).toBe(rules);
	});
});

/** A mark filling `box`, standing for what a scene draws there. */
function mark({ x, y, width, height }: Box): Shape {
	return {
		shape: "rect",
		x,
		y,
		width,
		height,
		corner: 0,
		fill: "#000000",
		stroke: "#000000",
		strokeWidth: 0,
	};
}

/** A line across the middle of `box`, which has no box of its own. */
function rule({ x, y, width, height }: Box): Shape {
	const middle = y + height / 2;
	return {
		shape: "line",
		x1: x,
		y1: middle,
		x2: x + width,
		y2: middle,
		stroke: "#000000",
		strokeWidth: 1,
	};
}

describe("stacked", () => {
	const map: Scene = {
		extent: { x: -16, y: -40, width: 752, height: 100 },
		shapes: [mark({ x: 0, y: -24, width: 720, height: 68 })],
	};

	test("sets the second scene under the first, centred, the two extents touching", () => {
		const view = { x: 0, y: 0, width: 468, height: 168 };
		const under = {
			extent: { x: -16, y: -16, width: 500, height: 200 },
			shapes: [mark(view)],
		};
		expect(stacked(map, under)).toEqual({
			extent: { x: -16, y: -40, width: 752, height: 300 },
			shapes: [...map.shapes, mark({ ...view, x: 126, y: 76 })],
		});
	});

	test("widens to the second scene, centring the first over it", () => {
		const view = { x: 0, y: 0, width: 968, height: 168 };
		const under = {
			extent: { x: -16, y: -16, width: 1000, height: 200 },
			shapes: [mark(view)],
		};
		expect(stacked(map, under)).toEqual({
			extent: { x: -140, y: -40, width: 1000, height: 300 },
			shapes: [...map.shapes, mark({ ...view, x: -124, y: 76 })],
		});
	});
});

describe("rowPages", () => {
	// Rows 50 high and 16 apart, the fourth 300 high, in a view 132 wide: a page may run to
	// 132 × √2 ≈ 186.7.
	const rows: Box[] = [0, 66, 132, 198, 514].map((y, i) => ({
		x: 0,
		y,
		width: 100,
		height: i === 3 ? 300 : 50,
	}));
	const view = {
		extent: { x: -16, y: -16, width: 132, height: 596 },
		rows,
		shapes: rows.flatMap((row) => [mark(row), rule(row)]),
	};
	const drawn = (i: number) => [mark(rows[i]), rule(rows[i])];

	test("puts whole rows on pages as wide as the view, each at most √2 times that tall", () => {
		expect(rowPages(view)).toEqual([
			{
				extent: { x: -16, y: -16, width: 132, height: 148 },
				shapes: [...drawn(0), ...drawn(1)],
			},
			{
				extent: { x: -16, y: 116, width: 132, height: 82 },
				shapes: drawn(2),
			},
			{
				extent: { x: -16, y: 182, width: 132, height: 332 },
				shapes: drawn(3),
			},
			{
				extent: { x: -16, y: 498, width: 132, height: 82 },
				shapes: drawn(4),
			},
		]);
	});
});
