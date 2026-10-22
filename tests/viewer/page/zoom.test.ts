// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import type { Frame } from "../../../src/viewer/page/frame";
import { zoomBy } from "../../../src/viewer/page/zoom";
import {
	circular,
	input,
	laidOut,
	linear,
	nextPaint,
	opened,
	wheel,
} from "../live";

function zoom(frame: Frame): HTMLFieldSetElement {
	const found = frame.bar.querySelector<HTMLFieldSetElement>(".zoom");
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

describe("a frame's zoom", () => {
	test("sits at the bar's right after the views: a slider from 1× to 8×, and Reset", () => {
		const frame = opened(circular);
		const end = frame.bar.lastElementChild;
		// The selection's caption follows while the sequence view is off.
		expect([...(end?.children ?? [])].map((one) => one.className)).toEqual([
			"views",
			"zoom",
			"selection",
		]);
		const slider = zoom(frame).querySelector("input");
		expect([slider?.type, slider?.min, slider?.max, slider?.value]).toEqual([
			"range",
			"0",
			"3",
			"0",
		]);
		expect(zoom(frame).querySelector("button")?.textContent).toBe("Reset");
	});

	test("Ctrl or ⌘ with the wheel zooms the map, laid out once a frame", async () => {
		const frame = opened(linear);
		expect(wheel(frame, { deltaY: -20, ctrlKey: true })).toBe(true);
		expect(wheel(frame, { deltaY: -20, metaKey: true })).toBe(true);
		await nextPaint();
		const zoomed = 2 ** (2 * zoomBy({ deltaY: -20, deltaMode: 0 }, 0));
		expect(frame.shown().zoom).toBeCloseTo(zoomed, 9);
		expect(frame.box.innerHTML).toBe(laidOut(frame, { zoom: zoomed }));
	});

	test("keeps the place of the map at the pointer under it", async () => {
		const frame = opened(linear);
		const before = frame.redraw().extent;
		wheel(frame, { deltaY: -100, ctrlKey: true, clientX: 300, clientY: 40 });
		await nextPaint();
		const after = frame.redraw().extent;
		const { scrollLeft, scrollTop } = frame.box;
		expect(after.x + scrollLeft + 300).toBeCloseTo(
			Math.SQRT2 * (before.x + 300),
			6,
		);
		expect(after.y + scrollTop + 40).toBeCloseTo(before.y + 40, 6);
	});

	test("stops at 1× and at 8×", async () => {
		const frame = opened(circular);
		for (let i = 0; i < 8; i++) wheel(frame, { deltaY: -100, ctrlKey: true });
		await nextPaint();
		expect(frame.shown().zoom).toBe(8);
		for (let i = 0; i < 8; i++) wheel(frame, { deltaY: 100, ctrlKey: true });
		await nextPaint();
		expect(frame.shown().zoom).toBe(1);
	});

	test("leaves a plain wheel over the line to scroll the page", async () => {
		const frame = opened(linear);
		const drawn = frame.box.innerHTML;
		expect(wheel(frame, { deltaY: -100 })).toBe(false);
		await nextPaint();
		expect(frame.shown().zoom).toBe(1);
		expect(frame.box.innerHTML).toBe(drawn);
	});
});

describe("the zoom's slider", () => {
	function slider(frame: Frame): HTMLInputElement {
		const found = zoom(frame).querySelector("input");
		if (!found) throw new Error("no slider");
		return found;
	}

	test("zooms the map to its doublings", async () => {
		const frame = opened(circular);
		slider(frame).value = "1.5";
		slider(frame).dispatchEvent(new Event("input", { bubbles: true }));
		await nextPaint();
		expect(frame.shown().zoom).toBeCloseTo(2 ** 1.5, 9);
		expect(frame.box.innerHTML).toBe(laidOut(frame, { zoom: 2 ** 1.5 }));
	});

	test("shows the zoom of the map flipped to", async () => {
		const frame = opened(circular);
		wheel(frame, { deltaY: -100, ctrlKey: true });
		await nextPaint();
		expect(slider(frame).valueAsNumber).toBe(0.5);
		input(frame, "line").click();
		expect(slider(frame).valueAsNumber).toBe(0);
		input(frame, "circle").click();
		expect(slider(frame).valueAsNumber).toBeCloseTo(0.5, 9);
	});
});

test("Reset returns the map to 1×, its origin at the top, and its box to the start", () => {
	const frame = opened(circular);
	Object.assign(frame.shown(), { zoom: 4, turn: 30 });
	frame.redraw();
	frame.box.scrollLeft = 200;
	frame.box.scrollTop = 100;
	zoom(frame).querySelector("button")?.click();
	expect(frame.shown()).toEqual({ zoom: 1, turn: 0, left: 0, top: 0 });
	expect([frame.box.scrollLeft, frame.box.scrollTop]).toEqual([0, 0]);
	expect(frame.box.innerHTML).toBe(laidOut(frame, {}));
});
