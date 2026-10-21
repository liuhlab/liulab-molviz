// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { boxPlace, hoverBox } from "../../src/viewer/hover";

const NAMESPACE = "http://www.w3.org/2000/svg";

/** An `<svg>` on the page holding a rect for each of `hovers`, each with its `<title>`. */
function drawn(...hovers: string[]): SVGSVGElement {
	const svg = document.createElementNS(NAMESPACE, "svg");
	for (const hover of hovers) {
		const rect = document.createElementNS(NAMESPACE, "rect");
		const title = document.createElementNS(NAMESPACE, "title");
		title.textContent = hover;
		rect.append(title);
		svg.append(rect);
	}
	document.body.append(svg);
	return svg;
}

function move(target: EventTarget, clientX = 100, clientY = 50): void {
	target.dispatchEvent(
		new PointerEvent("pointermove", { bubbles: true, clientX, clientY }),
	);
}

/** The box, if shown: each line's text, and whether it is bold. */
function shown(): [string, boolean][] | null {
	const boxes = document.querySelectorAll<HTMLElement>("body > div");
	expect(boxes).toHaveLength(1);
	const [box] = boxes;
	if (box.hidden) return null;
	return [...box.children].map((line) => [
		line.textContent ?? "",
		(line as HTMLElement).style.fontWeight === "700",
	]);
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("hoverBox", () => {
	test("shows a hover at once in a box set off the pointer, its first line bold, and takes the titles out", () => {
		const svg = drawn("lacZ\nCDS\n146 .. 469\n324 bp");
		hoverBox(svg);
		expect(svg.querySelectorAll("title")).toHaveLength(0);
		move(svg.children[0], 100, 50);
		expect(shown()).toEqual([
			["lacZ", true],
			["CDS", false],
			["146 .. 469", false],
			["324 bp", false],
		]);
		const box = document.querySelector<HTMLElement>("body > div");
		expect([box?.style.left, box?.style.top]).toEqual(["114px", "64px"]);
	});

	test("follows the pointer from one hover to the next, and hides off them or out of the window", () => {
		const svg = drawn("lacZ\nCDS", "EcoRI\ncut site\n396");
		hoverBox(svg);
		const [lacZ, ecoRI] = svg.children;
		move(lacZ);
		move(ecoRI, 200, 80);
		expect(shown()?.[0]).toEqual(["EcoRI", true]);
		move(svg);
		expect(shown()).toBeNull();
		move(ecoRI);
		document.dispatchEvent(
			new PointerEvent("pointerout", { bubbles: true, relatedTarget: null }),
		);
		expect(shown()).toBeNull();
	});

	test("leaves out a blank first line, as an item with no name has", () => {
		const svg = drawn(" \ninsertion\n12^13\n6 bp");
		hoverBox(svg);
		move(svg.children[0]);
		expect(shown()).toEqual([
			["insertion", false],
			["12^13", false],
			["6 bp", false],
		]);
	});

	test("shows what a drawing's resolver says over no hover, as one plain line, and a hover under the pointer first", () => {
		const svg = drawn("lacZ\nCDS");
		const base = document.createElementNS(NAMESPACE, "text");
		svg.append(base);
		hoverBox(svg, (event) =>
			event.clientX > 0 ? `position ${event.clientX}` : null,
		);
		move(base, 151, 20);
		expect(shown()).toEqual([["position 151", false]]);
		move(base, 152, 20);
		expect(shown()).toEqual([["position 152", false]]);
		move(svg.children[0], 151, 20);
		expect(shown()).toEqual([
			["lacZ", true],
			["CDS", false],
		]);
		move(base, 0, 20);
		expect(shown()).toBeNull();
		const other = drawn();
		hoverBox(other);
		move(other, 151, 20);
		expect(shown()).toBeNull();
	});

	test("keeps one box on a page, however many drawings show their hovers in it", () => {
		const first = drawn("lacZ");
		const second = drawn("AmpR");
		hoverBox(first);
		hoverBox(second);
		move(second.children[0]);
		expect(shown()).toEqual([["AmpR", true]]);
	});
});

describe("boxPlace", () => {
	const room = { width: 800, height: 600 };
	const box = { width: 120, height: 60 };

	test.each([
		[
			"right of and below the pointer",
			{ x: 100, y: 50 },
			{ left: 114, top: 64 },
		],
		[
			"left of it near the window's right edge",
			{ x: 700, y: 50 },
			{ left: 566, top: 64 },
		],
		[
			"above it near the bottom edge",
			{ x: 100, y: 560 },
			{ left: 114, top: 486 },
		],
		[
			"no further left or up than the window's corner",
			{ x: 100, y: 50 },
			{ left: 0, top: 0 },
			{ width: 150, height: 90 },
		],
	])("sets the box %s", (_, pointer, place, narrow = room) => {
		expect(boxPlace(pointer, box, narrow)).toEqual(place);
	});
});
