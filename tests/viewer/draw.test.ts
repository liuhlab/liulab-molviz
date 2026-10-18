// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { draw, drawGel } from "../../src/viewer/draw";
import { FormatError } from "../../src/viewer/record";
import { family, fontFaceCss } from "../../src/viewer/text";

const record = {
	name: "pTest 中",
	circular: false,
	bases: "ACGT".repeat(25),
	features: [
		{
			name: "lacZ",
			type: "CDS",
			strand: 1,
			segments: [{ start: 10, end: 60 }],
		},
	],
};

const gel = {
	title: "PCR products",
	ladder: { name: "ladder", bands: [100, 1000] },
	lanes: [{ name: "GFP", bands: [741] }],
};

function spot(): HTMLElement {
	const element = document.createElement("div");
	document.body.append(element);
	return element;
}

afterEach(() => {
	document.head.replaceChildren();
	document.body.replaceChildren();
});

describe("draw", () => {
	test("puts one SVG in the element, its letters as text in the viewer's faces", () => {
		const element = spot();
		draw(element, record, {});
		expect(element.children).toHaveLength(1);
		const svg = element.children[0];
		expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
		const texts = [...svg.querySelectorAll("text")];
		expect(texts.map((t) => t.textContent)).toEqual(
			expect.arrayContaining(["lacZ", "pTest �"]),
		);
		for (const text of texts) {
			expect(text.getAttribute("font-family")).toBe(family);
		}
	});

	test("declares the faces on the page once, however many drawings it holds", () => {
		draw(spot(), record, {});
		draw(spot(), record, {});
		const styles = document.querySelectorAll("style");
		expect(styles).toHaveLength(1);
		expect(styles[0].textContent).toBe(fontFaceCss());
	});

	test("returns a handle whose destroy removes the drawing alone, harmlessly twice", () => {
		const element = spot();
		const before = document.createElement("p");
		element.append(before);
		const other = spot();
		draw(other, record, {});
		const drawing = draw(element, record, {});
		drawing.destroy();
		drawing.destroy();
		expect([...element.children]).toEqual([before]);
		expect(other.querySelectorAll("svg")).toHaveLength(1);
		expect(document.querySelectorAll("style")).toHaveLength(1);
	});

	test("throws a FormatError on a bad record, adding nothing to the page", () => {
		const element = spot();
		expect(() => draw(element, { ...record, bases: "" }, {})).toThrow(
			new FormatError("bases: must hold at least one base"),
		);
		expect(element.children).toHaveLength(0);
		expect(document.querySelectorAll("style")).toHaveLength(0);
	});
});

describe("drawGel", () => {
	test("puts one SVG in the element, its letters as text in the viewer's faces", () => {
		const element = spot();
		drawGel(element, gel);
		expect(element.children).toHaveLength(1);
		const svg = element.children[0];
		expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
		const texts = [...svg.querySelectorAll("text")];
		expect(texts.map((t) => t.textContent)).toEqual(
			expect.arrayContaining(["PCR products", "GFP: 741 bp"]),
		);
		for (const text of texts) {
			expect(text.getAttribute("font-family")).toBe(family);
		}
		expect(document.querySelectorAll("style")).toHaveLength(1);
	});

	test("names a band's size when the pointer rests on it, and nothing else", () => {
		const element = spot();
		drawGel(element, gel);
		const titles = [...element.querySelectorAll("title")];
		expect(
			titles.map((title) => [title.parentElement?.tagName, title.textContent]),
		).toEqual([
			["rect", "100 bp"],
			["rect", "1000 bp"],
			["rect", "741 bp"],
		]);
	});

	test("returns a handle whose destroy removes the drawing", () => {
		const element = spot();
		const drawing = drawGel(element, gel);
		drawing.destroy();
		expect(element.children).toHaveLength(0);
	});

	test("throws a FormatError on a bad gel, adding nothing to the page", () => {
		const element = spot();
		expect(() =>
			drawGel(element, { ...gel, lanes: [{ name: "GFP" }] }),
		).toThrow(new FormatError("lanes[0].bands: missing"));
		expect(element.children).toHaveLength(0);
		expect(document.querySelectorAll("style")).toHaveLength(0);
	});
});
