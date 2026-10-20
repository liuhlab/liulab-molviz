// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Frame } from "../../src/viewer/frame";
import {
	angleOf,
	lineX,
	pointAt,
	rowHolding,
	rowX,
} from "../../src/viewer/geometry";
import type { Span } from "../../src/viewer/record";
import { circular, input, linear, opened } from "./live";

/** The key `linear`'s one feature is known by in every view. */
const LACZ =
	'{"kind":"features","name":"lacZ","spans":[{"start":10,"end":60}]}';

afterEach(() => {
	vi.useRealTimers();
	document.head.replaceChildren();
	document.body.replaceChildren();
});

/**
 * A pointer event of the mouse's main button at (`x`, `y`), in the drawing's points: a page with
 * no layout maps a drawing's points to client pixels one to one.
 */
function pointer(
	type: string,
	x = 0,
	y = 0,
	init: PointerEventInit = {},
): PointerEvent {
	return new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		clientX: x,
		clientY: y,
		pointerId: 1,
		pointerType: "mouse",
		button: 0,
		buttons: 1,
		...init,
	});
}

/** Press and let go on `target` at (`x`, `y`), without moving. */
function click(target: Element, x = 0, y = 0): void {
	target.dispatchEvent(pointer("pointerdown", x, y));
	target.dispatchEvent(pointer("pointerup", x, y));
}

/**
 * Press on `target` at the first of `points`, move through the rest with the pointer held, as
 * the drawing that captures it hears, and let go at the last.
 */
function drag(
	target: Element,
	points: readonly (readonly [number, number])[],
): void {
	const [first, ...rest] = points;
	target.dispatchEvent(pointer("pointerdown", ...first));
	const held = target.closest("svg") ?? target;
	for (const point of rest)
		held.dispatchEvent(pointer("pointermove", ...point));
	held.dispatchEvent(pointer("pointerup", ...(rest.at(-1) ?? first)));
}

/** Where the middle of each of `bases` lies on the line of `frame`'s map, at its height `y`. */
function alongLine(
	frame: Frame,
	bases: readonly number[],
	y = 0,
): [number, number][] {
	const { geometry } = frame.map();
	if (geometry.map !== "line") throw new Error("not a line");
	return bases.map((base) => [lineX(geometry, base + 0.5), y]);
}

/** Where the middle of each of `bases` lies on the backbone of `frame`'s circle. */
function aroundCircle(
	frame: Frame,
	bases: readonly number[],
): [number, number][] {
	const { geometry } = frame.map();
	if (geometry.map !== "circle") throw new Error("not a circle");
	return bases.map((base) =>
		pointAt(geometry.radius, angleOf(base + 0.5, geometry)),
	);
}

/** Where the middle of each of `bases` lies in `frame`'s sequence view, on the `strand` given. */
function onBases(
	frame: Frame,
	bases: readonly number[],
	strand: "top" | "bottom" = "top",
): [number, number][] {
	const rows = frame.sequence()?.rows ?? [];
	return bases.map((base) => {
		const row = rowHolding(rows, base);
		const [top, bottom] = row?.strands[strand] ?? [NaN, NaN];
		return [row ? rowX(row, base + 0.5) : NaN, (top + bottom) / 2];
	});
}

/**
 * Lay `frame`'s pane out as a browser would: `height` CSS pixels tall at the window's top, its
 * bar `bar` of them, the view's points one pixel each from the bar's foot down, scrolled by the
 * pane. Returns the client y of a point of the view.
 */
function laidOutPane(
	frame: Frame,
	{ height = 200, bar = 30 } = {},
): (y: number) => number {
	const { pane, paneBar } = frame;
	const svg = viewSvg(frame);
	const top = Number(svg.getAttribute("viewBox")?.split(" ")[1]);
	Object.defineProperty(pane, "clientHeight", { value: height });
	pane.getBoundingClientRect = () => new DOMRect(0, 0, 800, height);
	paneBar.getBoundingClientRect = () => new DOMRect(0, 0, 800, bar);
	const client = (y: number) => bar + y - top - pane.scrollTop;
	svg.getScreenCTM = () => new DOMMatrix([1, 0, 0, 1, 0, client(0)]);
	return client;
}

/** The map's drawing in `frame`. */
function mapSvg(frame: Frame): SVGSVGElement {
	const svg = frame.box.querySelector("svg");
	if (!svg) throw new Error("no map drawn");
	return svg;
}

/** The sequence view's drawing in `frame`. */
function viewSvg(frame: Frame): SVGSVGElement {
	const svg = frame.pane.querySelector("svg");
	if (!svg) throw new Error("no sequence view drawn");
	return svg;
}

/** The first shape in `svg` drawing the item `key`. */
function itemIn(svg: Element, key: string): Element {
	const found = [...svg.querySelectorAll("[data-molviz-item]")].find(
		(shape) => shape.getAttribute("data-molviz-item") === key,
	);
	if (!found) throw new Error(`no ${key} drawn`);
	return found;
}

/** The items `svg` outlines as selected, by their keys. */
function outlined(svg: Element): Set<string | null> {
	return new Set(
		[...svg.querySelectorAll("[data-molviz-selected]")].map((shape) =>
			shape.getAttribute("data-molviz-item"),
		),
	);
}

/** The spans `frame` has selected; none for a point or nothing. */
function spansOf(frame: Frame): readonly Span[] {
	const { selection } = frame.state;
	return selection && "spans" in selection ? selection.spans : [];
}

/** How many shapes shade a selection in `svg`. */
function shadings(svg: Element): number {
	return svg.querySelectorAll("[fill='#bbddf5']").length;
}

/** The shaded boxes in `svg`, each as its left and right edges in points. */
function shaded(svg: Element): number[][] {
	return [...svg.querySelectorAll("rect[fill='#bbddf5']")].map((rect) => [
		Number(rect.getAttribute("x")),
		Number(rect.getAttribute("x")) + Number(rect.getAttribute("width")),
	]);
}

describe("a click on an item", () => {
	test("on the map selects it, outlined and its span shaded in every view", () => {
		const frame = opened(linear, { sequence_view: true });
		click(itemIn(mapSvg(frame), LACZ));
		expect(frame.state.selection).toEqual({
			spans: [{ start: 10, end: 60 }],
			item: LACZ,
		});
		for (const svg of [mapSvg(frame), viewSvg(frame)]) {
			expect(outlined(svg)).toEqual(new Set([LACZ]));
		}
		// 7.2 points a base on the line, 11 in the view's 60-base rows.
		expect(shaded(mapSvg(frame))).toEqual([[72, 432]]);
		expect(shaded(viewSvg(frame))).toEqual([[110, 660]]);
	});

	test("in the sequence view selects it as on the map", () => {
		const frame = opened(linear, { sequence_view: true });
		click(itemIn(viewSvg(frame), LACZ));
		expect(frame.state.selection?.item).toBe(LACZ);
		expect(outlined(mapSvg(frame))).toEqual(new Set([LACZ]));
		expect(shaded(mapSvg(frame))).toEqual([[72, 432]]);
	});

	test("on the item selected, or on empty space in either view, clears", () => {
		const frame = opened(linear, { sequence_view: true });
		const clear = [
			() => itemIn(mapSvg(frame), LACZ),
			() => itemIn(viewSvg(frame), LACZ),
			// Each drawing's ground.
			() => mapSvg(frame).firstElementChild as Element,
			() => viewSvg(frame).firstElementChild as Element,
		];
		for (const on of clear) {
			click(itemIn(mapSvg(frame), LACZ));
			expect(frame.state.selection).not.toBeNull();
			click(on());
			expect(frame.state.selection).toBeNull();
			for (const svg of [mapSvg(frame), viewSvg(frame)]) {
				expect(outlined(svg)).toEqual(new Set());
				expect(shaded(svg)).toEqual([]);
			}
		}
	});
});

describe("the selection", () => {
	test("is kept across flips, zooms, turns, switches and redraws, and drawn again in each", () => {
		const frame = opened(circular, { sequence_view: true });
		const key = LACZ;
		click(itemIn(mapSvg(frame), key));
		const selected = frame.state.selection;
		const kept = () => {
			expect(frame.state.selection).toBe(selected);
			expect(shadings(mapSvg(frame))).toBeGreaterThan(0);
			expect(shaded(viewSvg(frame))).toEqual([[110, 660]]);
		};
		input(frame, "line").click();
		kept();
		expect(shaded(mapSvg(frame))).toEqual([[72, 432]]);
		frame.shown().zoom = 2;
		frame.redraw();
		kept();
		expect(shaded(mapSvg(frame))).toEqual([[144, 864]]);
		input(frame, "circle").click();
		frame.shown().turn = 30;
		frame.redraw(true);
		kept();
		input(frame, "features").click();
		kept();
		expect(outlined(mapSvg(frame))).toEqual(new Set());
		input(frame, "features").click();
		kept();
		expect(outlined(mapSvg(frame))).toEqual(new Set([key]));
		expect(outlined(viewSvg(frame))).toEqual(new Set([key]));
		frame.reset();
		kept();
	});
});

describe("a drag across the map", () => {
	test("on the line selects the bases from the one pressed to the one under the pointer, either way", () => {
		const frame = opened(linear, { sequence_view: true });
		const ground = mapSvg(frame).firstElementChild as Element;
		drag(ground, alongLine(frame, [20, 24, 29]));
		expect(frame.state.selection).toEqual({
			spans: [{ start: 20, end: 30 }],
			item: null,
		});
		expect(shaded(mapSvg(frame))).toEqual([[144, 216]]);
		expect(shaded(viewSvg(frame))).toEqual([[220, 330]]);
		drag(ground, alongLine(frame, [29, 20]));
		expect(frame.state.selection).toEqual({
			spans: [{ start: 20, end: 30 }],
			item: null,
		});
	});

	test("pressed on an item selects bases and outlines no item, once it moves past a click", () => {
		const frame = opened(linear, { sequence_view: true });
		const lacZ = itemIn(mapSvg(frame), LACZ);
		const [[x, y]] = alongLine(frame, [12]);
		drag(lacZ, [
			[x, y],
			[x + 3, y],
		]);
		expect(frame.state.selection?.item).toBe(LACZ);
		drag(lacZ, alongLine(frame, [12, 40]));
		expect(frame.state.selection).toEqual({
			spans: [{ start: 12, end: 41 }],
			item: null,
		});
		for (const svg of [mapSvg(frame), viewSvg(frame)]) {
			expect(outlined(svg)).toEqual(new Set());
		}
	});

	test("keeps the page's text from being selected while it lasts", () => {
		const frame = opened(linear);
		const svg = mapSvg(frame);
		const selecting = () => {
			const event = new Event("selectstart", {
				bubbles: true,
				cancelable: true,
			});
			svg.dispatchEvent(event);
			return event.defaultPrevented;
		};
		svg.dispatchEvent(pointer("pointerdown"));
		expect(selecting()).toBe(true);
		svg.dispatchEvent(pointer("pointerup"));
		expect(selecting()).toBe(false);
	});

	test("round the circle follows the pointer across the origin, either way", () => {
		const frame = opened(circular, { sequence_view: true });
		const ground = mapSvg(frame).firstElementChild as Element;
		const across = { spans: [{ start: 95, end: 105 }], item: null };
		drag(ground, aroundCircle(frame, [95, 98, 1, 4]));
		expect(frame.state.selection).toEqual(across);
		drag(ground, aroundCircle(frame, [4, 1, 98, 95]));
		expect(frame.state.selection).toEqual(across);
		// In the view, the end of the last row and the start of the first.
		expect(shaded(viewSvg(frame))).toEqual([
			[0, 55],
			[385, 440],
		]);
	});

	test("round the circle selects the whole record at a full turn, however turned", () => {
		const frame = opened(circular);
		frame.shown().turn = 100;
		frame.redraw();
		const ground = mapSvg(frame).firstElementChild as Element;
		drag(ground, aroundCircle(frame, [10, 40, 70, 99, 20, 9]));
		expect(frame.state.selection).toEqual({
			spans: [{ start: 0, end: 100 }],
			item: null,
		});
		drag(ground, aroundCircle(frame, [10, 40]));
		expect(frame.state.selection).toEqual({
			spans: [{ start: 10, end: 41 }],
			item: null,
		});
	});
});

describe("a drag across bases", () => {
	test("selects them from the base pressed, across rows, either way, in both views", () => {
		const frame = opened(linear, { sequence_view: true });
		const ground = viewSvg(frame).firstElementChild as Element;
		const stretch = { spans: [{ start: 20, end: 76 }], item: null };
		drag(ground, onBases(frame, [20, 40, 75]));
		expect(frame.state.selection).toEqual(stretch);
		expect(shaded(viewSvg(frame))).toEqual([
			[220, 660],
			[0, 176],
		]);
		expect(shaded(mapSvg(frame))).toEqual([[144, 547.2]]);
		drag(ground, onBases(frame, [75, 20], "bottom"));
		expect(frame.state.selection).toEqual(stretch);
	});

	test("selects the base pressed alone, at once", () => {
		const frame = opened(linear, { sequence_view: true });
		const ground = viewSvg(frame).firstElementChild as Element;
		ground.dispatchEvent(pointer("pointerdown", ...onBases(frame, [20])[0]));
		expect(frame.state.selection).toEqual({
			spans: [{ start: 20, end: 21 }],
			item: null,
		});
	});

	test("with the bottom strand hidden, finds no base under the rail and shades down to it", () => {
		const frame = opened(linear, { sequence_view: true });
		const ground = viewSvg(frame).firstElementChild as Element;
		frame.state.options = { ...frame.state.options, bottom_strand: false };
		frame.changed();
		click(ground, ...onBases(frame, [20], "bottom")[0]);
		expect(frame.state.selection).toBeNull();
		drag(ground, onBases(frame, [20, 29]));
		const [row] = frame.sequence()?.rows ?? [];
		const band = viewSvg(frame).querySelector("rect[fill='#bbddf5']");
		const foot =
			Number(band?.getAttribute("y")) + Number(band?.getAttribute("height"));
		expect(foot).toBeCloseTo(row.strands.rail, 1);
	});
});

describe("a drag across bases past the pane's edge", () => {
	test("scrolls the pane 20 times as far a second as the pointer is past it, selecting what comes into sight", () => {
		vi.useFakeTimers({
			toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
		});
		const long = { ...linear, bases: "ACGT".repeat(250) };
		const frame = opened(long, { sequence_view: true });
		const { pane } = frame;
		const client = laidOutPane(frame);
		const svg = viewSvg(frame);
		const [x, y] = onBases(frame, [20])[0];
		svg.dispatchEvent(pointer("pointerdown", x, client(y)));
		// 50 pixels under the pane's foot, for half a second.
		svg.dispatchEvent(pointer("pointermove", x, 250));
		vi.advanceTimersByTime(500);
		expect(pane.scrollTop).toBeGreaterThan(450);
		expect(pane.scrollTop).toBeLessThanOrEqual(500);
		const rows = frame.sequence()?.rows ?? [];
		const [{ end }] = spansOf(frame);
		// The last base selected is in the row at the pane's foot, where the pointer is held.
		const foot = rows.findLast((row) => client(row.y) <= 200);
		expect(rowHolding(rows, end - 1)).toBe(foot);
		// Back inside, the pane holds still.
		svg.dispatchEvent(pointer("pointermove", x, 100));
		const still = pane.scrollTop;
		vi.advanceTimersByTime(500);
		expect(pane.scrollTop).toBe(still);
		// Above the view, under the bar, it scrolls back up.
		svg.dispatchEvent(pointer("pointermove", x, 10));
		vi.advanceTimersByTime(500);
		expect(pane.scrollTop).toBeLessThan(still - 150);
		svg.dispatchEvent(pointer("pointerup", x, 10));
		const left = pane.scrollTop;
		vi.advanceTimersByTime(500);
		expect(pane.scrollTop).toBe(left);
	});
});

/** A linear record of 1,000 bases with one feature, `lacZ`, at 500 .. 560. */
const long = {
	...linear,
	bases: "ACGT".repeat(250),
	features: [{ ...linear.features[0], segments: [{ start: 500, end: 560 }] }],
};

/** The key `long`'s feature is known by. */
const LONG_LACZ = LACZ.replace('"start":10,"end":60', '"start":500,"end":560');

describe("the other view scrolls to the selection", () => {
	test("from the map, the pane bringing the row holding its start to its top, under its bar", () => {
		const frame = opened(long, { sequence_view: true });
		const client = laidOutPane(frame);
		const rows = frame.sequence()?.rows ?? [];
		const row = rowHolding(rows, 500);
		if (!row) throw new Error("no row holds 500");
		const lacZ = itemIn(mapSvg(frame), LONG_LACZ);
		click(lacZ);
		expect(client(row.y)).toBe(30);
		frame.pane.scrollTop = 2000;
		click(lacZ);
		click(lacZ);
		expect(client(row.y)).toBe(30);
		// A drag, once it ends.
		const later = rowHolding(rows, 800);
		if (!later) throw new Error("no row holds 800");
		drag(
			mapSvg(frame).firstElementChild as Element,
			alongLine(frame, [800, 900]),
		);
		expect(client(later.y)).toBe(30);
	});

	test("from the sequence view, the map's box only when zoomed, centring it there if out of sight", () => {
		const frame = opened(long, { sequence_view: true });
		const { box } = frame;
		Object.defineProperty(box, "clientWidth", { value: 300 });
		Object.defineProperty(box, "clientHeight", { value: 2000 });
		const lacZ = () => itemIn(viewSvg(frame), LONG_LACZ);
		click(lacZ());
		expect([box.scrollLeft, box.scrollTop]).toEqual([0, 0]);
		click(lacZ());
		frame.shown().zoom = 4;
		frame.redraw();
		click(lacZ());
		// 2.88 points a base at 4×: lacZ lies from 1440 to 1612.8.
		const { extent } = frame.drawn();
		expect(box.scrollLeft).toBeCloseTo(1526.4 - extent.x - 150, 6);
		expect(box.scrollTop).toBe(0);
		// In sight, it stays.
		box.scrollLeft -= 50;
		const kept = box.scrollLeft;
		click(lacZ());
		click(lacZ());
		expect(box.scrollLeft).toBe(kept);
	});

	test("from the sequence view, never turning the circle", () => {
		const frame = opened(circular, { sequence_view: true });
		frame.shown().zoom = 2;
		frame.redraw();
		click(itemIn(viewSvg(frame), LACZ));
		expect(frame.state.selection?.item).toBe(LACZ);
		expect(frame.shown().turn).toBe(0);
	});
});
