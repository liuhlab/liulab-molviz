import { describe, expect, test } from "vitest";
import type { Scene } from "../../src/viewer/scene";
import { toSvg } from "../../src/viewer/svg";
import { measure, outline } from "../../src/viewer/text";

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

	test("draws every letter as an outline, from where its anchor puts it", () => {
		expect(written).not.toContain("<text");
		const start = 360 - measure("lacZ", "sans", 11.5) / 2;
		expect(written).toContain(
			`<path d="${outline("lacZ", "sans", 11.5, start, 50)}" fill="#000000"/>`,
		);
		expect(written).toContain(
			`<path d="${outline("pUC19", "sans-bold", 13.5, 12, 70)}" fill="#252525"/>`,
		);
	});

	test("writes the shapes in order, every number with two decimals", () => {
		const tags = [...written.matchAll(/<(\w+)/g)].map((m) => m[1]);
		expect(tags).toEqual([
			"svg",
			"rect",
			"line",
			"path",
			"rect",
			"circle",
			"path",
			"path",
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
		expect(written).toMatch(/<path d="M[^"]* 0\.00L/);
		expect(written).not.toContain("-0.00");
	});

	test("writes no hover text, though a shape has one", () => {
		const hovered: Scene = {
			extent: { x: 0, y: 0, width: 10, height: 10 },
			shapes: [
				{ shape: "circle", cx: 5, cy: 5, r: 1, fill: "#000000", hover: "A1" },
			],
		};
		expect(toSvg(hovered)).not.toContain("<title");
	});
});
