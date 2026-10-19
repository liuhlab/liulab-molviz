// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { draw, drawGel, drawPlate } from "../../src/viewer/draw";
import { FormatError } from "../../src/viewer/format";
import { families, fontFaceCss } from "../../src/viewer/text";

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

const plate = {
	title: "picked 1",
	rows: 2,
	columns: 3,
	wells: { A1: "quarter 1", B3: "water" },
};

/** The map `draw` puts in an element for `record`, with no sequence view. */
function drawnMap(): Element {
	const element = document.createElement("div");
	draw(element, record, {});
	return element.children[0];
}

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
			expect(text.getAttribute("font-family")).toBe(families.sans);
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

	test("adds the sequence view under the map, its bases as text, and destroy removes both", () => {
		const element = spot();
		const drawing = draw(element, record, { sequence_view: true });
		const [map, view] = element.children;
		expect(element.children).toHaveLength(2);
		expect(map.outerHTML).toBe(drawnMap().outerHTML);
		expect((view as SVGSVGElement).style.display).toBe("block");
		const bases = [...view.querySelectorAll("text")].filter(
			(t) => t.getAttribute("font-family") === families.mono,
		);
		expect(bases[0].textContent).toBe("ACGT".repeat(15));
		drawing.destroy();
		expect(element.children).toHaveLength(0);
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
			expect(text.getAttribute("font-family")).toBe(families.sans);
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

describe("drawPlate", () => {
	test("puts one SVG in the element, its letters as text in the viewer's faces", () => {
		const element = spot();
		drawPlate(element, plate);
		expect(element.children).toHaveLength(1);
		const svg = element.children[0];
		expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
		const texts = [...svg.querySelectorAll("text")];
		expect(texts.map((t) => t.textContent)).toEqual(
			expect.arrayContaining(["picked 1", "A", "B", "1", "3", "quarter 1"]),
		);
		for (const text of texts) {
			expect(text.getAttribute("font-family")).toBe(families.sans);
		}
		expect(document.querySelectorAll("style")).toHaveLength(1);
	});

	test("names a well and its contents when the pointer rests on it, an empty well by its name alone, and nothing else", () => {
		const element = spot();
		drawPlate(element, plate);
		const titles = [...element.querySelectorAll("title")];
		expect(
			titles.map((title) => [title.parentElement?.tagName, title.textContent]),
		).toEqual([
			["rect", "A1: quarter 1"],
			["rect", "A2"],
			["rect", "A3"],
			["rect", "B1"],
			["rect", "B2"],
			["rect", "B3: water"],
		]);
	});

	test("returns a handle whose destroy removes the drawing", () => {
		const element = spot();
		const drawing = drawPlate(element, plate);
		drawing.destroy();
		expect(element.children).toHaveLength(0);
	});

	test("throws a FormatError on a bad plate, adding nothing to the page", () => {
		const element = spot();
		expect(() =>
			drawPlate(element, { ...plate, wells: { C1: "water" } }),
		).toThrow(
			new FormatError("wells.C1: not on the plate, which runs A1 to B3"),
		);
		expect(element.children).toHaveLength(0);
		expect(document.querySelectorAll("style")).toHaveLength(0);
	});
});
