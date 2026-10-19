import { Window } from "happy-dom";
import { describe, expect, test } from "vitest";
import { draw, drawGel, drawPlate } from "../../src/viewer/draw";
import {
	gelSvg,
	plateSvg,
	prepare,
	prepareGel,
	preparePlate,
	prepareViews,
	stackedViews,
	svg,
} from "../../src/viewer/drawing";
import { FormatError } from "../../src/viewer/format";
import {
	fontRules,
	gelStillSvg,
	plateStillSvg,
	stillSvg,
} from "../../src/viewer/still";
import { measure, weights } from "../../src/viewer/text";
import gel from "../gels/golden-gate-pcr-products.json";
import plate from "../plates/ap1-pcr2-plate.json";
import ap1 from "../records/ap1-product.json";
import primers from "../records/primer-test.json";
import puc19 from "../records/puc19-gfp-product.json";

const every = { enzymes: [...new Set(ap1.cuts.map((cut) => cut.enzyme))] };
const line = { ...every, map: "line" };
const view = { sequence_view: true };

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

/** `element` without its hover, written as a file writes it. */
function withoutHover(element: string): string {
	return element
		.replace(/<title>.*?<\/title>/s, "")
		.replace(/^(<\w+[^>]*)><\/\w+>$/, "$1/>");
}

// A record with its sequence view draws live as two SVGs, compared in the block for it below.
const drawings = [
	{
		input: "a record on the line",
		still: stillSvg(ap1, line),
		file: svg(ap1, line),
		scene: prepare(ap1, line),
		live: (element: Element) => draw(element, ap1, line),
	},
	{
		input: "a record on the circle that hides labels",
		still: stillSvg(ap1, every),
		file: svg(ap1, every),
		scene: prepare(ap1, every),
		live: (element: Element) => draw(element, ap1, every),
	},
	{
		input: "a record on the circle, names set along its arcs",
		still: stillSvg(puc19),
		file: svg(puc19),
		scene: prepare(puc19, {}),
		live: (element: Element) => draw(element, puc19),
	},
	{
		input: "a record with its sequence view",
		still: stillSvg(primers, view),
		file: svg(primers, view),
		scene: stackedViews(prepareViews(primers, view)),
		live: undefined,
	},
	{
		input: "a gel",
		still: gelStillSvg(gel),
		file: gelSvg(gel),
		scene: prepareGel(gel),
		live: (element: Element) => drawGel(element, gel),
	},
	{
		input: "a plate",
		still: plateStillSvg(plate),
		file: plateSvg(plate),
		scene: preparePlate(plate),
		live: (element: Element) => drawPlate(element, plate),
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
		expect(held.children[0].isEqualNode(drawn.children[0])).toBe(true);
	},
);

describe.each(drawings)("the still SVG of $input", ({ still, file, scene }) => {
	test("hides what its file hides, with the same notice", () => {
		expect(still.hidden).toEqual(file.hidden);
		expect(still.notice).toBe(file.notice);
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
			else expect(withoutHover(element)).toBe(theirs.children[i]);
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
	const [map, sequence] = [...live.children];
	const held = document.createElement("div");
	held.innerHTML = stillSvg(primers, view).svg;
	const [ground, ...still] = [...held.children[0].children];
	const [, ...mapShapes] = [...map.children];
	const [, ...viewShapes] = [...sequence.children];

	test("is the live map, then the live sequence view moved under it", () => {
		expect(ground.tagName.toLowerCase()).toBe("rect");
		expect(still).toHaveLength(mapShapes.length + viewShapes.length);
		mapShapes.forEach((shape, i) => {
			expect(still[i].isEqualNode(shape)).toBe(true);
		});
		viewShapes.forEach((shape, i) => {
			const ours = still[mapShapes.length + i];
			expect(ours.tagName).toBe(shape.tagName);
			expect(ours.textContent).toBe(shape.textContent);
			const unplaced = (element: Parsed) =>
				Array.from(element.attributes)
					.filter(({ name }) => !PLACES.includes(name))
					.map(({ name, value }) => [name, value]);
			expect(unplaced(ours)).toEqual(unplaced(shape));
		});
	});

	test("sets its letters as the live view does, every text moved by one step", () => {
		const texts = viewShapes.flatMap((shape, i) =>
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

test("the record hides labels, so the notice is drawn", () => {
	expect(stillSvg(ap1, every).notice).not.toBe("");
});

test("the circle sets a name along an arc as real text, a letter at a place", () => {
	const { svg: written } = stillSvg(puc19);
	expect(written).toMatch(/<text [^>]*rotate="[^"]*"[^>]*>[^<]+<\/text>/);
	expect(written).not.toContain("<use ");
});

test("draws with no page to draw in", () => {
	expect(typeof document).toBe("undefined");
	expect(gelStillSvg(gel).svg).toMatch(/^<svg /);
});

const record = { name: "p", circular: false, bases: "ACGT".repeat(25) };

test.each([
	{
		call: () => stillSvg({ ...record, bases: "" }),
		problem: "bases: must hold at least one base",
	},
	{
		call: () => stillSvg(record, { span: { start: 0, end: 101 } }),
		problem: "options.span.end: must be at most the record's length, 100",
	},
	{
		call: () => stillSvg({ ...record, bases: "ACGT".repeat(25_001) }, view),
		problem:
			"options.sequence_view: must be false past 100,000 bases, and the span holds 100,004",
	},
	{
		call: () => gelStillSvg({ ...gel, lanes: [{ name: "GFP" }] }),
		problem: "lanes[0].bands: missing",
	},
	{
		call: () => plateStillSvg({ rows: 2, columns: 3, wells: { C1: "water" } }),
		problem: "wells.C1: not on the plate, which runs A1 to B3",
	},
])("throws the input's FormatError: $problem", ({ call, problem }) => {
	expect(call).toThrow(new FormatError(problem));
});

test("writes a name that holds markup as text, in a label and in a hover", () => {
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
