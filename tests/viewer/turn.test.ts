// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { aroundBoxes } from "../../src/viewer/bounds";
import { openRecord } from "../../src/viewer/draw";
import { layoutMap } from "../../src/viewer/drawing";
import type { Frame } from "../../src/viewer/frame";
import { hoverBox } from "../../src/viewer/hover";
import type { MapScene } from "../../src/viewer/labels";
import { checkOptions } from "../../src/viewer/options";
import { check } from "../../src/viewer/record";
import { toElement } from "../../src/viewer/svg";
import { turnBy } from "../../src/viewer/turn";

const ring = {
	name: "pRing",
	circular: true,
	bases: "ACGT".repeat(25),
	features: [
		{
			name: "a-long-feature-name",
			type: "CDS",
			strand: 1,
			segments: [{ start: 10, end: 12 }],
		},
	],
};

function opened(record: unknown, options: unknown = {}): Frame {
	const element = document.createElement("div");
	document.body.append(element);
	const checked = check(record);
	return openRecord(
		element,
		checked,
		checkOptions(options, checked, { page: true }),
	);
}

/** A wheel over `frame`'s map, and whether the frame kept the browser from scrolling. */
function wheel(frame: Frame, init: WheelEventInit): boolean {
	const event = new WheelEvent("wheel", { cancelable: true, ...init });
	// happy-dom's WheelEvent is no MouseEvent, as a browser's is.
	Object.defineProperty(event, "ctrlKey", { value: init.ctrlKey ?? false });
	Object.defineProperty(event, "metaKey", { value: false });
	frame.box.dispatchEvent(event);
	return event.defaultPrevented;
}

/** `scene` as a frame shows it. */
function shown(scene: MapScene): string {
	const svg = toElement(scene, document);
	hoverBox(svg);
	return svg.outerHTML;
}

const nextPaint = () =>
	new Promise<void>((done) => requestAnimationFrame(() => done()));

function flip(frame: Frame, map: "circle" | "line"): void {
	frame.bar.querySelector<HTMLInputElement>(`input[value="${map}"]`)?.click();
}

afterEach(() => {
	document.head.replaceChildren();
	document.body.replaceChildren();
});

describe("turnBy", () => {
	test("turns 0.072° for each pixel, wheel down counter-clockwise", () => {
		expect(turnBy({ deltaY: 100, deltaMode: 0 }, 0)).toBeCloseTo(-7.2, 9);
		expect(turnBy({ deltaY: -100, deltaMode: 0 }, 0)).toBeCloseTo(7.2, 9);
	});

	test("counts a line as 16 pixels and a page as the box's height", () => {
		expect(turnBy({ deltaY: 3, deltaMode: 1 }, 0)).toBeCloseTo(-3.456, 9);
		expect(turnBy({ deltaY: 1, deltaMode: 2 }, 500)).toBeCloseTo(-36, 9);
	});
});

describe("the wheel over the circle", () => {
	test("turns it, once a frame, over a box that takes in the ring before and after", async () => {
		const frame = opened(ring);
		const before = frame.drawn().extent;
		expect(wheel(frame, { deltaY: 1000 })).toBe(true);
		expect(wheel(frame, { deltaY: 1500 })).toBe(true);
		await nextPaint();
		expect(frame.state.maps.circle.turn).toBeCloseTo(-180, 9);
		const turned = layoutMap(frame.record, frame.state.options, { turn: -180 });
		const { extent } = frame.drawn();
		expect(aroundBoxes([extent, before, turned.extent])).toEqual(extent);
		expect(frame.box.innerHTML).toBe(shown({ ...turned, extent }));
	});

	test("holds the box and its scale from the first notch on, so the page under it stays put", async () => {
		const frame = opened(ring);
		const room = frame.box.parentElement as HTMLElement;
		Object.defineProperty(room, "clientWidth", { value: 300 });
		wheel(frame, { deltaY: 100 });
		await nextPaint();
		const held = frame.drawn();
		expect(held.scale).toBeLessThan(1);
		// Two full turns, a notch of 7.2° a frame.
		for (let notch = 0; notch < 100; notch++) {
			wheel(frame, { deltaY: 100 });
			await nextPaint();
			expect(frame.drawn()).toEqual(held);
		}
	});

	test("keeps the ring in place on a zoomed circle", async () => {
		const frame = opened(ring);
		frame.shown().zoom = 2;
		const before = frame.redraw().extent;
		frame.box.scrollLeft = 100;
		frame.box.scrollTop = 50;
		wheel(frame, { deltaY: 1800 });
		await nextPaint();
		const after = frame.drawn().extent;
		expect(after.x).toBeLessThan(before.x);
		expect(-after.x - frame.box.scrollLeft).toBeCloseTo(-before.x - 100, 9);
		expect(-after.y - frame.box.scrollTop).toBeCloseTo(-before.y - 50, 9);
	});

	test("zooms it instead with Ctrl", async () => {
		const frame = opened(ring);
		expect(wheel(frame, { deltaY: -100, ctrlKey: true })).toBe(true);
		await nextPaint();
		expect(frame.state.maps.circle).toMatchObject({ zoom: 2 ** 0.5, turn: 0 });
	});

	test("leaves a sideways swipe to scroll the box", async () => {
		const frame = opened(ring);
		expect(wheel(frame, { deltaX: 100, deltaY: 10 })).toBe(false);
		await nextPaint();
		expect(frame.state.maps.circle.turn).toBe(0);
	});
});

test("a turn or a zoom under a still pointer hides the hover box, its item gone", async () => {
	const frame = opened(ring);
	const floating = () =>
		document.querySelector<HTMLElement>("body > div:not(:has(svg))");
	const rest = () =>
		frame.box
			.querySelector("[data-molviz-hover]")
			?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
	rest();
	expect(floating()?.hidden).toBe(false);
	wheel(frame, { deltaY: 100 });
	await nextPaint();
	expect(floating()?.hidden).toBe(true);
	rest();
	expect(floating()?.hidden).toBe(false);
	wheel(frame, { deltaY: -100, ctrlKey: true });
	await nextPaint();
	expect(floating()?.hidden).toBe(true);
});

test("the turn survives a flip to the line and back", async () => {
	const frame = opened(ring);
	wheel(frame, { deltaY: -500 });
	await nextPaint();
	flip(frame, "line");
	expect(wheel(frame, { deltaY: -500 })).toBe(false);
	await nextPaint();
	flip(frame, "circle");
	expect(frame.state.maps.circle.turn).toBeCloseTo(36, 9);
	const turned = layoutMap(frame.record, frame.state.options, { turn: 36 });
	expect(frame.box.innerHTML).toBe(shown(turned));
});
