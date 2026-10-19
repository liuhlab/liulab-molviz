import { Window } from "happy-dom";
import { describe, expect, test } from "vitest";
import { draw, drawGel, drawPlate } from "../../src/viewer/draw";
import {
	gelSvg,
	plateSvg,
	prepare,
	prepareGel,
	preparePlate,
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
import crowded from "../records/crowded-sites.json";

const every = { enzymes: [...new Set(crowded.cuts.map((cut) => cut.enzyme))] };

/** The root's opening tag, and each element inside it as written. */
function elements(written: string): { root: string; children: string[] } {
	const root = /^<svg[^>]*>/.exec(written)?.[0] ?? "";
	const inside = written.slice(root.length, -"</svg>".length);
	const children = inside.match(/<(\w+)[^>]*?(?:\/>|>.*?<\/\1>)/gs) ?? [];
	expect(children.join("")).toBe(inside);
	return { root, children };
}

/** `element` without its hover, written as a file writes it. */
function withoutHover(element: string): string {
	return element
		.replace(/<title>.*?<\/title>/s, "")
		.replace(/^(<\w+[^>]*)><\/\w+>$/, "$1/>");
}

describe.each([
	{
		input: "a record that hides labels",
		still: stillSvg(crowded, every),
		file: svg(crowded, every),
		scene: prepare(crowded, every),
		live: (element: Element) => draw(element, crowded, every),
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
])("the still SVG of $input", ({ still, file, scene, live }) => {
	test("is what the live call draws, once a page parses it", () => {
		const { document } = new Window();
		const drawn = document.createElement("div");
		live(drawn as unknown as Element);
		const held = document.createElement("div");
		held.innerHTML = still.svg;
		expect(held.children).toHaveLength(1);
		// The parser keeps the namespace as an attribute too, which draws nothing.
		held.children[0].removeAttribute("xmlns");
		expect(held.children[0].isEqualNode(drawn.children[0])).toBe(true);
	});

	test("hides what its file hides, with the same notice", () => {
		expect(still.hidden).toEqual(file.hidden);
		expect(still.notice).toBe(file.notice);
	});

	test("is its file but for the letters and the hovers", () => {
		const ours = elements(still.svg);
		const theirs = elements(file.svg);
		expect(ours.root).toBe(theirs.root);
		expect(ours.children).toHaveLength(theirs.children.length);
		ours.children.forEach((element, i) => {
			if (element.startsWith("<text "))
				expect(theirs.children[i]).toMatch(/^<path d="[^"]*" fill="[^"]*"\/>$/);
			else expect(withoutHover(element)).toBe(theirs.children[i]);
		});
	});

	test("holds each text to its measured width, in the viewer's faces", () => {
		const texts = scene.shapes.flatMap((s) => (s.shape === "text" ? [s] : []));
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
		texts.forEach(({ text, face, size }, i) => {
			expect(written[i]).toMatchObject({
				"font-family": "molviz Sans",
				"font-weight": face === "sans-bold" ? "700" : "400",
				textLength: measure(text, face, size).toFixed(2),
			});
		});
	});
});

test("the record hides labels, so the notice is drawn", () => {
	expect(stillSvg(crowded, every).notice).not.toBe("");
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
		draw(element as unknown as Element, crowded);
		expect(document.getElementById("molviz-fonts")?.textContent).toBe(rules);
	});
});
