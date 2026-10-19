// @vitest-environment happy-dom
import { describe, expect, test } from "vitest";
import type { Scene } from "../../src/viewer/scene";
import { toElement, toSvg } from "../../src/viewer/svg";
import { type Face, glyphs, measure } from "../../src/viewer/text";

const scene: Scene = {
	extent: { x: -16, y: -30.5, width: 752, height: 120.25 },
	shapes: [
		{
			shape: "line",
			x1: 0,
			y1: 0,
			x2: 720,
			y2: 0,
			stroke: "#252525",
			strokeWidth: 2.6,
		},
		{
			shape: "polygon",
			points: [
				[0, 10],
				[100, 17.5],
				[0, 25],
			],
			fill: "#77aadd",
			stroke: "#364d63",
			strokeWidth: 0.8,
		},
		{
			shape: "rect",
			x: 10,
			y: -20,
			width: 30,
			height: 15.39,
			corner: 2,
			fill: "#993366",
			stroke: "#45172e",
			strokeWidth: 0.8,
		},
		{ shape: "circle", cx: -7, cy: 1.9, r: 1.8, fill: "#252525" },
		{
			shape: "text",
			text: "lacZ",
			face: "sans",
			size: 11.5,
			x: 360,
			y: 50,
			anchor: "middle",
			fill: "#000000",
		},
		{
			shape: "text",
			text: "pUC19",
			face: "sans-bold",
			size: 13.5,
			x: 12,
			y: 70,
			anchor: "start",
			fill: "#252525",
		},
		{
			shape: "text",
			text: "ACGA",
			face: "mono",
			size: 11,
			cell: 11,
			x: 0,
			y: 90,
			anchor: "start",
			fill: "#1c1e21",
		},
	],
};

const written = toSvg(scene);

describe("toSvg", () => {
	test("sizes the drawing to its extent with no unit, so one unit is one point", () => {
		expect(written).toMatch(
			/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="752\.00" height="120\.25" viewBox="-16\.00 -30\.50 752\.00 120\.25">/,
		);
	});

	test("paints a white ground under everything", () => {
		expect(written).toContain(
			'><rect x="-16.00" y="-30.50" width="752.00" height="120.25" fill="#ffffff"/>',
		);
		expect(written.indexOf('fill="#ffffff"')).toBeLessThan(
			written.indexOf("<line"),
		);
	});

	test("draws every letter as a use of its glyph, each glyph defined once before the ground", () => {
		expect(written).not.toContain("<text");
		const defined = [
			...(
				written.match(/^<svg[^>]*><defs>(.*?)<\/defs><rect /)?.[1] ?? ""
			).matchAll(/<path id="([^"]+)" d="([^"]+)"\/>/g),
		].map((m) => [m[1], m[2]]);
		const texts: [string, Face][] = [
			["lacZ", "sans"],
			["pUC19", "sans-bold"],
			["ACGA", "mono"],
		];
		const expected = new Map(
			texts.flatMap(([text, face]) =>
				glyphs(text, face, 10).map((g) => [g.id, g.outline] as const),
			),
		);
		expect(defined).toEqual([...expected]);
		expect(written.match(/<use /g)).toHaveLength(13);
	});

	test("sets each text from where its anchor puts it, scaled from its face's units", () => {
		const uses = (text: string, face: Face) =>
			glyphs(text, face, 2048)
				.map((g) => `<use href="#${g.id}" x="${g.x.toFixed(2)}"/>`)
				.join("");
		const start = 360 - measure("lacZ", "sans", 11.5) / 2;
		expect(written).toContain(
			`<g transform="translate(${start.toFixed(2)} 50.00) scale(0.005615234375)" fill="#000000">${uses("lacZ", "sans")}</g>`,
		);
		expect(written).toContain(
			`<g transform="translate(12.00 70.00) scale(0.006591796875)" fill="#252525">${uses("pUC19", "sans-bold")}</g>`,
		);
	});

	test("sets text in cells a glyph to a cell, each centred in its own", () => {
		const [a, c, g] = glyphs("ACG", "mono", 11);
		expect(written).toContain(
			'<g transform="translate(0.00 90.00) scale(0.00537109375)" fill="#1c1e21">' +
				`<use href="#${a.id}" x="407.50"/><use href="#${c.id}" x="2455.50"/>` +
				`<use href="#${g.id}" x="4503.50"/><use href="#${a.id}" x="6551.50"/></g>`,
		);
	});

	test("writes the shapes in order, every number with two decimals", () => {
		const shapes = written.slice(written.indexOf("</defs>"));
		const tags = [...shapes.matchAll(/<(\w+)/g)].map((m) => m[1]);
		const uses = (count: number) => Array(count).fill("use");
		expect(tags).toEqual([
			"rect",
			"line",
			"path",
			"rect",
			"circle",
			"g",
			...uses(4),
			"g",
			...uses(5),
			"g",
			...uses(4),
		]);
		expect(written).toContain(
			'<line x1="0.00" y1="0.00" x2="720.00" y2="0.00" stroke="#252525" stroke-width="2.60"/>',
		);
		expect(written).toContain(
			'<path d="M0.00 10.00L100.00 17.50L0.00 25.00Z" fill="#77aadd" stroke="#364d63" stroke-width="0.80"/>',
		);
		expect(written).toContain(
			'<rect x="10.00" y="-20.00" width="30.00" height="15.39" rx="2.00" fill="#993366" stroke="#45172e" stroke-width="0.80"/>',
		);
		expect(written).toContain(
			'<circle cx="-7.00" cy="1.90" r="1.80" fill="#252525"/>',
		);
	});

	test("never writes a negative zero, in a shape or a letter's outline", () => {
		const tiny: Scene = {
			extent: { x: 0, y: 0, width: 10, height: 10 },
			shapes: [
				{ shape: "circle", cx: -0.001, cy: 0, r: 1, fill: "#000000" },
				{
					shape: "text",
					text: "I",
					face: "sans",
					size: 12,
					x: 0,
					y: -0.001,
					anchor: "start",
					fill: "#000000",
				},
			],
		};
		const written = toSvg(tiny);
		expect(written).toContain('cx="0.00"');
		expect(written).toContain("translate(0.00 0.00)");
		expect(written).toMatch(/<path id="[^"]+" d="M[^"]* 0\.00L/);
		expect(written).not.toContain("-0.00");
	});
});

describe("toElement", () => {
	test("writes text set in cells as one text element, each letter placed in its cell", () => {
		const svg = toElement(
			{
				extent: { x: 0, y: 0, width: 50, height: 30 },
				shapes: [
					{
						shape: "text",
						text: "ACGA",
						face: "mono",
						size: 11,
						cell: 11,
						x: 22,
						y: 20,
						anchor: "middle",
						fill: "#1c1e21",
					},
				],
			},
			document,
		);
		const texts = svg.querySelectorAll("text");
		expect(texts).toHaveLength(1);
		const [text] = texts;
		expect(text.textContent).toBe("ACGA");
		expect(text.getAttribute("x")).toBe("2.19 13.19 24.19 35.19");
		expect(text.getAttribute("y")).toBe("20.00");
		expect(text.getAttribute("font-family")).toBe("molviz Mono");
		expect(text.getAttribute("font-weight")).toBe("400");
		expect(text.hasAttribute("textLength")).toBe(false);
	});
});
