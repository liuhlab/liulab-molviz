// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { draw, drawGel, drawPlate } from "../../src/viewer/draw";
import { FormatError } from "../../src/viewer/format";
import { families, fontFaceCss } from "../../src/viewer/text";
import { hoverBoxOf, spot } from "./live";

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
function drawnMap(): Element | null {
	const element = document.createElement("div");
	draw(element, record, {});
	return element.querySelector(".map > svg");
}

afterEach(() => {
	document.head.replaceChildren();
	document.body.replaceChildren();
});

describe("draw", () => {
	test("puts one SVG in the element, its letters as text in the viewer's faces", () => {
		const element = spot();
		draw(element, record, {});
		expect(element.querySelectorAll("svg")).toHaveLength(1);
		const svg = element.querySelectorAll("svg")[0];
		expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
		const texts = [...svg.querySelectorAll("text")];
		expect(texts.map((t) => t.textContent)).toEqual(
			expect.arrayContaining(["lacZ", "pTest �"]),
		);
		for (const text of texts) {
			expect(text.getAttribute("font-family")).toBe(families.sans);
		}
	});

	test("declares the faces and the page's style once, however many drawings it holds", () => {
		draw(spot(), record, {});
		draw(spot(), record, {});
		const styles = document.querySelectorAll("style");
		expect(styles).toHaveLength(2);
		expect(document.getElementById("molviz-fonts")?.textContent).toBe(
			fontFaceCss(),
		);
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
		expect(document.querySelectorAll("style")).toHaveLength(2);
	});

	test("adds the sequence view under the map, its bases as text, and destroy removes both", () => {
		const element = spot();
		const drawing = draw(element, record, { sequence_view: true });
		const map = element.querySelector(".map > svg");
		const view = element.querySelector(".map + .sequence > svg");
		if (!map || !view) throw new Error("not drawn");
		expect(element.querySelectorAll("svg")).toHaveLength(2);
		expect(map.outerHTML).toBe(drawnMap()?.outerHTML);
		const bases = [...view.querySelectorAll("text")].filter(
			(t) => t.getAttribute("font-family") === families.mono,
		);
		expect(bases[0].textContent).toBe("ACGT".repeat(15));
		drawing.destroy();
		expect(element.children).toHaveLength(0);
	});

	test("lays the map and the sequence view each first on a white ground as large as it", () => {
		const element = spot();
		draw(element, record, { sequence_view: true });
		const drawn = [...element.querySelectorAll("svg")];
		expect(drawn).toHaveLength(2);
		for (const svg of drawn) {
			const [x, y, width, height] =
				svg.getAttribute("viewBox")?.split(" ") ?? [];
			expect(svg.firstElementChild?.outerHTML).toBe(
				`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#ffffff"></rect>`,
			);
		}
	});

	test("shows the map's hovers in a box at once, with no title left in it", () => {
		const element = spot();
		draw(element, record, {});
		const map = element.querySelector(".map > svg");
		expect(map?.querySelectorAll("title")).toHaveLength(0);
		const arrow = map?.querySelector("path[fill='#77aadd']");
		arrow?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
		const box = hoverBoxOf();
		expect(box?.hasAttribute("hidden")).toBe(false);
		expect([...(box?.children ?? [])].map((line) => line.textContent)).toEqual([
			"lacZ",
			"CDS",
			"11 .. 60",
			"50 bp",
		]);
	});

	test("leaves the sequence view out past 100,000 bases, with no error", () => {
		const long = { ...record, bases: "ACGT".repeat(25_001) };
		const element = spot();
		draw(element, long, { sequence_view: true });
		const alone = spot();
		draw(alone, long, {});
		expect(element.innerHTML).toBe(alone.innerHTML);
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
