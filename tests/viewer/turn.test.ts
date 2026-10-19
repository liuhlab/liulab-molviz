// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { aroundBoxes } from "../../src/viewer/bounds";
import { layoutMap } from "../../src/viewer/drawing";
import { hoverBox } from "../../src/viewer/hover";
import type { MapScene } from "../../src/viewer/labels";
import { checkOptions } from "../../src/viewer/options";
import { openPage, type Page } from "../../src/viewer/page";
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

/** A wheel over `page`'s map, and whether the page kept the browser from scrolling. */
function wheel(page: Page, init: WheelEventInit): boolean {
	const event = new WheelEvent("wheel", { cancelable: true, ...init });
	// happy-dom's WheelEvent is no MouseEvent, as a browser's is.
	Object.defineProperty(event, "ctrlKey", { value: init.ctrlKey ?? false });
	Object.defineProperty(event, "metaKey", { value: false });
	page.box.dispatchEvent(event);
	return event.defaultPrevented;
}

/** `scene` as a page shows it. */
function shown(scene: MapScene): string {
	const svg = toElement(scene, document);
	hoverBox(svg);
	return svg.outerHTML;
}

const frame = () =>
	new Promise<void>((done) => requestAnimationFrame(() => done()));

function flip(page: Page, map: "circle" | "line"): void {
	page.bar.querySelector<HTMLInputElement>(`input[value="${map}"]`)?.click();
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
	test("turns it, once a frame, its box taking in the one before so the ring stays put", async () => {
		const page = opened(ring);
		const before = page.drawn().extent;
		expect(wheel(page, { deltaY: 1000 })).toBe(true);
		expect(wheel(page, { deltaY: 1500 })).toBe(true);
		await frame();
		expect(page.state.maps.circle.turn).toBeCloseTo(-180, 9);
		const turned = layoutMap(page.record, page.state.options, { turn: -180 });
		const held = {
			...turned,
			extent: aroundBoxes([before, turned.extent]),
		};
		expect(held.extent).not.toEqual(turned.extent);
		expect(page.box.innerHTML).toBe(shown(held));
	});

	test("keeps the ring in place on a zoomed circle", async () => {
		const page = opened(ring);
		page.shown().zoom = 2;
		const before = page.redraw().extent;
		page.box.scrollLeft = 100;
		page.box.scrollTop = 50;
		wheel(page, { deltaY: 1800 });
		await frame();
		const after = page.drawn().extent;
		expect(after.x).toBeLessThan(before.x);
		expect(-after.x - page.box.scrollLeft).toBeCloseTo(-before.x - 100, 9);
		expect(-after.y - page.box.scrollTop).toBeCloseTo(-before.y - 50, 9);
	});

	test("zooms it instead with Ctrl", async () => {
		const page = opened(ring);
		expect(wheel(page, { deltaY: -100, ctrlKey: true })).toBe(true);
		await frame();
		expect(page.state.maps.circle).toMatchObject({ zoom: 2 ** 0.5, turn: 0 });
	});

	test("leaves a sideways swipe to scroll the box", async () => {
		const page = opened(ring);
		expect(wheel(page, { deltaX: 100, deltaY: 10 })).toBe(false);
		await frame();
		expect(page.state.maps.circle.turn).toBe(0);
	});
});

test("the turn survives a flip to the line and back", async () => {
	const page = opened(ring);
	wheel(page, { deltaY: -500 });
	await frame();
	flip(page, "line");
	expect(wheel(page, { deltaY: -500 })).toBe(false);
	await frame();
	flip(page, "circle");
	expect(page.state.maps.circle.turn).toBeCloseTo(36, 9);
	const turned = layoutMap(page.record, page.state.options, { turn: 36 });
	expect(page.box.innerHTML).toBe(shown(turned));
});
