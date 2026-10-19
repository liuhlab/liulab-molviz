// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { layoutMap } from "../../src/viewer/drawing";
import { checkOptions } from "../../src/viewer/options";
import { openPage, type Page } from "../../src/viewer/page";
import { check } from "../../src/viewer/record";
import { toElement } from "../../src/viewer/svg";
import { anchored, eachFrame, zoomBy } from "../../src/viewer/zoom";

const linear = {
	name: "pTest",
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

const circular = { ...linear, name: "pRing", circular: true };

/** `record` opened on a page with `options`, as `draw` opens it. */
function opened(record: unknown, options: unknown = {}): Page {
	const element = document.createElement("div");
	document.body.append(element);
	const checked = check(record);
	return openPage(
		element,
		checked,
		checkOptions(options, checked, { page: true }),
	);
}

/** The map `page` shows, as a fresh layout at `view` would draw it. */
function laidOut(page: Page, view: { zoom?: number; turn?: number }): string {
	return toElement(layoutMap(page.record, page.state.options, view), document)
		.outerHTML;
}

/** A wheel over `page`'s map, and whether the page kept the browser from scrolling. */
function wheel(page: Page, init: WheelEventInit): boolean {
	const event = new WheelEvent("wheel", { cancelable: true, ...init });
	// happy-dom's WheelEvent is no MouseEvent, as a browser's is.
	const mouse = { ctrlKey: false, metaKey: false, clientX: 0, clientY: 0 };
	for (const [key, value] of Object.entries({ ...mouse, ...init })) {
		if (key in mouse) Object.defineProperty(event, key, { value });
	}
	page.box.dispatchEvent(event);
	return event.defaultPrevented;
}

const frame = () =>
	new Promise<void>((done) => requestAnimationFrame(() => done()));

function input(page: Page, value: string): HTMLInputElement {
	const found = page.bar.querySelector<HTMLInputElement>(
		`input[value="${value}"]`,
	);
	if (!found) throw new Error(`no ${value} in the bar`);
	return found;
}

function zoom(page: Page): HTMLFieldSetElement {
	const found = page.bar.querySelector<HTMLFieldSetElement>(".zoom");
	if (!found) throw new Error("no zoom in the bar");
	return found;
}

afterEach(() => {
	document.head.replaceChildren();
	document.body.replaceChildren();
});

describe("zoomBy", () => {
	test("zooms in by a pinch's scale, in doublings", () => {
		const pinch = { deltaY: -100 * Math.log(1.25), deltaMode: 0 };
		expect(zoomBy(pinch, 0)).toBeCloseTo(Math.log2(1.25), 6);
	});

	test("zooms a wheel's notch half a doubling at most, either way", () => {
		expect(zoomBy({ deltaY: 100, deltaMode: 0 }, 0)).toBe(-0.5);
		expect(zoomBy({ deltaY: -3, deltaMode: 1 }, 0)).toBe(0.5);
	});

	test("counts a line as 16 pixels and a page as the box's height", () => {
		expect(zoomBy({ deltaY: -1, deltaMode: 1 }, 0)).toBeCloseTo(0.2308, 4);
		expect(zoomBy({ deltaY: -1, deltaMode: 2 }, 20)).toBeCloseTo(0.2885, 4);
	});
});

describe("anchored", () => {
	test("keeps the point at the pointer in place on a line zoomed along its length", () => {
		const scroll = anchored(
			"line",
			{ x: -16, y: -100, width: 752, height: 200 },
			{ x: -16, y: -120, width: 1472, height: 220 },
			{ scale: 1, at: { x: 100, y: 50 }, left: 0, top: 0, by: 2 },
		);
		expect(scroll).toEqual({ left: 84, top: 20 });
	});

	test("keeps the point at the pointer in place on a circle zoomed about its centre", () => {
		const scroll = anchored(
			"circle",
			{ x: -300, y: -300, width: 600, height: 600 },
			{ x: -520, y: -520, width: 1040, height: 1040 },
			{ scale: 0.5, at: { x: 150, y: 50 }, left: 50, top: 50, by: 2 },
		);
		expect(scroll).toEqual({ left: 210, top: 110 });
	});
});

describe("a page's zoom", () => {
	test("sits at the bar's right: a slider from 1× to 8×, and Reset", () => {
		const page = opened(circular);
		expect(page.bar.lastElementChild).toBe(zoom(page));
		const slider = zoom(page).querySelector("input");
		expect([slider?.type, slider?.min, slider?.max, slider?.value]).toEqual([
			"range",
			"0",
			"3",
			"0",
		]);
		expect(zoom(page).querySelector("button")?.textContent).toBe("Reset");
	});

	test("Ctrl or ⌘ with the wheel zooms the map, laid out once a frame", async () => {
		const page = opened(linear);
		expect(wheel(page, { deltaY: -20, ctrlKey: true })).toBe(true);
		expect(wheel(page, { deltaY: -20, metaKey: true })).toBe(true);
		await frame();
		const zoomed = 2 ** (2 * zoomBy({ deltaY: -20, deltaMode: 0 }, 0));
		expect(page.shown().zoom).toBeCloseTo(zoomed, 9);
		expect(page.box.innerHTML).toBe(laidOut(page, { zoom: zoomed }));
	});

	test("keeps the place of the map at the pointer under it", async () => {
		const page = opened(linear);
		const before = page.redraw().extent;
		wheel(page, { deltaY: -100, ctrlKey: true, clientX: 300, clientY: 40 });
		await frame();
		const after = page.redraw().extent;
		const { scrollLeft, scrollTop } = page.box;
		expect(after.x + scrollLeft + 300).toBeCloseTo(
			Math.SQRT2 * (before.x + 300),
			6,
		);
		expect(after.y + scrollTop + 40).toBeCloseTo(before.y + 40, 6);
	});

	test("stops at 1× and at 8×", async () => {
		const page = opened(circular);
		for (let i = 0; i < 8; i++) wheel(page, { deltaY: -100, ctrlKey: true });
		await frame();
		expect(page.shown().zoom).toBe(8);
		for (let i = 0; i < 8; i++) wheel(page, { deltaY: 100, ctrlKey: true });
		await frame();
		expect(page.shown().zoom).toBe(1);
	});

	test("leaves a plain wheel over the line to scroll the page", async () => {
		const page = opened(linear);
		const drawn = page.box.innerHTML;
		expect(wheel(page, { deltaY: -100 })).toBe(false);
		await frame();
		expect(page.shown().zoom).toBe(1);
		expect(page.box.innerHTML).toBe(drawn);
	});
});

describe("the zoom's slider", () => {
	function slider(page: Page): HTMLInputElement {
		const found = zoom(page).querySelector("input");
		if (!found) throw new Error("no slider");
		return found;
	}

	test("zooms the map to its doublings", async () => {
		const page = opened(circular);
		slider(page).value = "1.5";
		slider(page).dispatchEvent(new Event("input", { bubbles: true }));
		await frame();
		expect(page.shown().zoom).toBeCloseTo(2 ** 1.5, 9);
		expect(page.box.innerHTML).toBe(laidOut(page, { zoom: 2 ** 1.5 }));
	});

	test("shows the zoom of the map flipped to", async () => {
		const page = opened(circular);
		wheel(page, { deltaY: -100, ctrlKey: true });
		await frame();
		expect(slider(page).valueAsNumber).toBe(0.5);
		input(page, "line").click();
		expect(slider(page).valueAsNumber).toBe(0);
		input(page, "circle").click();
		expect(slider(page).valueAsNumber).toBeCloseTo(0.5, 9);
	});
});

test("Reset returns the map to 1×, its origin at the top, and its box to the start", () => {
	const page = opened(circular);
	Object.assign(page.shown(), { zoom: 4, turn: 30 });
	page.redraw();
	page.box.scrollLeft = 200;
	page.box.scrollTop = 100;
	zoom(page).querySelector("button")?.click();
	expect(page.shown()).toEqual({ zoom: 1, turn: 0, left: 0, top: 0 });
	expect([page.box.scrollLeft, page.box.scrollTop]).toEqual([0, 0]);
	expect(page.box.innerHTML).toBe(laidOut(page, {}));
});

test("eachFrame runs once in the next frame, however often asked", async () => {
	let runs = 0;
	const ask = eachFrame(window, () => runs++);
	ask();
	ask();
	ask();
	expect(runs).toBe(0);
	await frame();
	expect(runs).toBe(1);
	ask();
	await frame();
	expect(runs).toBe(2);
});
