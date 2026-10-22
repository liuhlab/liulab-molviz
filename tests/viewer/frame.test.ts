// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import {
	anchored,
	beforePaint,
	displayScale,
	type Frame,
	openFrame,
} from "../../src/viewer/frame";
import { rowHolding } from "../../src/viewer/geometry";
import { draw } from "../../src/viewer/index";
import { checkOptions } from "../../src/viewer/options";
import { VIEWS_APART } from "../../src/viewer/pane";
import { check } from "../../src/viewer/record";
import { layoutSequence } from "../../src/viewer/sequence";
import { layoutMap } from "../../src/viewer/views";
import {
	circular,
	hoverBoxOf,
	input,
	linear,
	nextPaint,
	opened,
	rest,
	spot,
} from "./live";

/** The map's drawing `draw` puts in a fresh frame for `record` and `options`. */
function mapOf(record: unknown, options: unknown = {}): string {
	const element = spot();
	draw(element, record, options);
	const svg = element.querySelector(".map svg");
	if (!svg) throw new Error("no map drawn");
	return svg.outerHTML;
}

/** The value of each input in the bar's views, as the reader sees them in order. */
function views(frame: Frame): string[] {
	return [...frame.bar.querySelectorAll<HTMLInputElement>(".views input")].map(
		(one) => one.value,
	);
}

afterEach(() => {
	document.head.replaceChildren();
	document.body.replaceChildren();
});

describe("displayScale", () => {
	test("shrinks a drawing wider than the room to fit it", () => {
		expect(displayScale(800, 400)).toBe(0.5);
	});

	test("never enlarges a drawing narrower than the room", () => {
		expect(displayScale(400, 800)).toBe(1);
	});

	test("keeps the size when the room is unknown", () => {
		expect(displayScale(800, 0)).toBe(1);
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

	test("keeps it in place when the scale the map shows at changes too", () => {
		const scroll = anchored(
			"circle",
			{ x: -300, y: -300, width: 600, height: 600 },
			{ x: -520, y: -520, width: 1040, height: 1040 },
			{
				scale: 0.5,
				rescaled: 0.4,
				at: { x: 150, y: 50 },
				left: 50,
				top: 50,
				by: 2,
			},
		);
		expect(scroll.left).toBeCloseTo(138, 9);
		expect(scroll.top).toBeCloseTo(78, 9);
	});
});

describe("a record's frame", () => {
	test("holds a bar, then the map's box, then the sequence view's", () => {
		const element = spot();
		draw(element, linear, {});
		expect(element.children).toHaveLength(1);
		const frame = element.children[0];
		expect(frame.className).toBe("molviz");
		expect([...frame.children].map((child) => child.className)).toEqual([
			"bar",
			"map",
			"sequence",
		]);
		expect(frame.querySelectorAll(".map > svg")).toHaveLength(1);
		expect(frame.querySelectorAll(".sequence svg")).toHaveLength(0);
	});

	test("flips a whole circular record between Circle and Line, and shows the sequence view", () => {
		expect(views(opened(circular))).toEqual(["circle", "line", "sequence"]);
	});

	test("offers no flip on a linear record or on a span", () => {
		expect(views(opened(linear))).toEqual(["sequence"]);
		expect(views(opened(circular, { span: { start: 0, end: 50 } }))).toEqual([
			"sequence",
		]);
	});

	test("offers no sequence view past 100,000 bases, nor its strands", () => {
		const long = { ...circular, bases: "ACGT".repeat(25_001) };
		const frame = opened(long, { sequence_view: true });
		expect(views(frame)).toEqual(["circle", "line"]);
		expect(
			frame.box.parentElement?.querySelector('[name="strands"]'),
		).toBeNull();
	});

	test("ticks the map and the sequence view the options open on", () => {
		const frame = opened(circular, { map: "line", sequence_view: true });
		expect(input(frame, "circle").checked).toBe(false);
		expect(input(frame, "line").checked).toBe(true);
		expect(input(frame, "sequence").checked).toBe(true);
	});
});

describe("flipping the map", () => {
	test("draws the map flipped to as a frame opening on it does", () => {
		const frame = opened(circular);
		input(frame, "line").click();
		expect(frame.state.options.map).toBe("line");
		expect(frame.box.innerHTML).toBe(mapOf(circular, { map: "line" }));
		input(frame, "circle").click();
		expect(frame.box.innerHTML).toBe(mapOf(circular));
	});

	test("keeps each map's zoom and scroll while the other shows", () => {
		const frame = opened(circular);
		frame.shown().zoom = 2;
		frame.redraw();
		const zoomed = frame.box.innerHTML;
		expect(zoomed).not.toBe(mapOf(circular));
		frame.box.scrollLeft = 30;
		frame.box.scrollTop = 40;
		input(frame, "line").click();
		expect([frame.box.scrollLeft, frame.box.scrollTop]).toEqual([0, 0]);
		expect(frame.box.innerHTML).toBe(mapOf(circular, { map: "line" }));
		frame.box.scrollLeft = 50;
		input(frame, "circle").click();
		expect([frame.box.scrollLeft, frame.box.scrollTop]).toEqual([30, 40]);
		expect(frame.box.innerHTML).toBe(zoomed);
		input(frame, "line").click();
		expect([frame.box.scrollLeft, frame.box.scrollTop]).toEqual([50, 0]);
	});

	test("shows the hovers of the map flipped to in the page's box, with no title", () => {
		const frame = opened(circular);
		input(frame, "line").click();
		expect(frame.box.querySelectorAll("title")).toHaveLength(0);
		const arrow = frame.box.querySelector("path[fill='#77aadd']");
		arrow?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
		expect(hoverBoxOf()?.hidden).toBe(false);
		expect(hoverBoxOf()?.firstElementChild?.textContent).toBe("lacZ");
	});
});

describe("the sequence view's switch", () => {
	test("shows the view as a frame opening with it does, and hides it again", () => {
		const frame = opened(linear);
		const pane = frame.box.nextElementSibling as HTMLElement;
		expect(pane.hidden).toBe(true);
		input(frame, "sequence").click();
		expect(frame.state.options.sequence_view).toBe(true);
		expect(pane.hidden).toBe(false);
		const fresh = spot();
		draw(fresh, linear, { sequence_view: true });
		expect(pane.innerHTML).toBe(fresh.querySelector(".sequence")?.innerHTML);
		input(frame, "sequence").click();
		expect(frame.state.options.sequence_view).toBe(false);
		expect(pane.hidden).toBe(true);
	});

	test("leaves the view as it is drawn when only the map changes", () => {
		const frame = opened(circular, { sequence_view: true });
		const sequence = frame.pane.querySelector("svg");
		expect(sequence).not.toBeNull();
		input(frame, "line").click();
		frame.shown().zoom = 2;
		frame.redraw();
		expect(frame.pane.querySelector("svg")).toBe(sequence);
	});
});

describe("the sequence view's hovers", () => {
	test("show in the page's box with no title, each on an item keyed as on the map", () => {
		const frame = opened(linear, { sequence_view: true });
		const pane = frame.box.nextElementSibling as HTMLElement;
		expect(pane.querySelectorAll("title")).toHaveLength(0);
		const hovers = [...pane.querySelectorAll("[data-molviz-hover]")];
		const keys = (within: Element) =>
			new Set(
				[...within.querySelectorAll("[data-molviz-item]")].map((shape) =>
					shape.getAttribute("data-molviz-item"),
				),
			);
		expect(hovers).toEqual([...pane.querySelectorAll("[data-molviz-item]")]);
		expect(keys(pane)).toEqual(
			new Set([
				'{"kind":"features","name":"lacZ","spans":[{"start":10,"end":60}]}',
			]),
		);
		expect(keys(frame.box)).toEqual(keys(pane));
		hovers[0].dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
		expect(hoverBoxOf()?.hidden).toBe(false);
		expect(hoverBoxOf()?.firstElementChild?.textContent).toBe("lacZ");
	});
});

/** Give `frame` a room `width` CSS pixels wide, as a window resized to it does. */
function resized(frame: Frame, width: number): void {
	const root = frame.box.parentElement as HTMLElement;
	Object.defineProperty(root, "clientWidth", {
		configurable: true,
		value: width,
	});
	window.dispatchEvent(new Event("resize"));
}

/** How wide `record`'s map at 1× and its sequence view with full and half rows lay out. */
function widthsOf(record: unknown, options: unknown = {}) {
	const checked = check(record);
	const all = checkOptions(
		{ sequence_view: true, ...(options as object) },
		checked,
		{
			page: true,
		},
	);
	const sequence = (perRow: number) =>
		layoutSequence(checked, { ...all, bases_per_row: perRow }).extent.width;
	return {
		map: layoutMap(checked, all).extent.width,
		full: sequence(all.bases_per_row),
		half: sequence(Math.ceil(all.bases_per_row / 2)),
	};
}

/** How far `frame`'s pane scrolls to show the row holding `base` at its top, at `scale`. */
function scrollFor(frame: Frame, base: number, scale = 1): number {
	const sequence = frame.sequence();
	const row = sequence && rowHolding(sequence.rows, base);
	if (!sequence || !row) throw new Error(`no row holds ${base}`);
	const [, top] = (sequence.svg.getAttribute("viewBox") ?? "").split(" ");
	return (row.y - Number(top)) * scale;
}

/** Scroll `frame`'s pane to `top`, as a reader does. */
function scrolled(frame: Frame, top: number): void {
	frame.pane.scrollTop = top;
	frame.pane.dispatchEvent(new Event("scroll"));
}

/** Press and let go on `target` with the mouse's main button, without moving. */
function click(target: Element): void {
	for (const type of ["pointerdown", "pointerup"]) {
		target.dispatchEvent(
			new PointerEvent(type, {
				bubbles: true,
				pointerId: 1,
				pointerType: "mouse",
				button: 0,
			}),
		);
	}
}

/** Whether `frame` shows the sequence view beside its map, and how many bases its rows hold. */
function arrangement(frame: Frame): { beside: boolean; perRow: number } {
	const rows = frame.sequence()?.rows ?? [];
	return {
		beside: frame.box.parentElement?.classList.contains("beside") ?? false,
		perRow: rows.length ? rows[0].end - rows[0].start : 0,
	};
}

/** A linear record of 600 bases, ten rows of 60. */
const long = { ...linear, bases: "ACGT".repeat(150) };

describe("where the sequence view sits", () => {
	test("beside the map with full rows when both fit at full size, else beside with half rows", () => {
		const frame = opened(long, { sequence_view: true });
		const { map, full, half } = widthsOf(long);
		resized(frame, map + VIEWS_APART + full);
		expect(arrangement(frame)).toEqual({ beside: true, perRow: 60 });
		resized(frame, map + VIEWS_APART + full - 1);
		expect(arrangement(frame)).toEqual({ beside: true, perRow: 30 });
		resized(frame, map + VIEWS_APART + half);
		expect(arrangement(frame)).toEqual({ beside: true, perRow: 30 });
	});

	test("under the map with full rows once half rows do not fit beside, else with half rows", () => {
		const frame = opened(long, { sequence_view: true });
		const { map, full, half } = widthsOf(long);
		resized(frame, map + VIEWS_APART + half - 1);
		expect(arrangement(frame)).toEqual({ beside: false, perRow: 60 });
		resized(frame, full);
		expect(arrangement(frame)).toEqual({ beside: false, perRow: 60 });
		resized(frame, full - 1);
		expect(arrangement(frame)).toEqual({ beside: false, perRow: 30 });
		resized(frame, half);
		expect(arrangement(frame)).toEqual({ beside: false, perRow: 30 });
		const svg = frame.pane.querySelector("svg");
		expect([svg?.style.width, svg?.style.height]).toEqual(["", ""]);
	});

	test("under with half rows scaled down to the room once they do not fit it", () => {
		const frame = opened(long, { sequence_view: true });
		const { half } = widthsOf(long);
		resized(frame, half / 2);
		expect(arrangement(frame)).toEqual({ beside: false, perRow: 30 });
		const svg = frame.pane.querySelector("svg");
		const [, , , height] = (svg?.getAttribute("viewBox") ?? "").split(" ");
		expect(parseFloat(svg?.style.width ?? "")).toBeCloseTo(half / 2, 6);
		expect(parseFloat(svg?.style.height ?? "")).toBeCloseTo(
			Number(height) / 2,
			2,
		);
	});

	test("keeping the first base of the pane's top row at its top, across full rows and half", () => {
		const options = { sequence_view: true, bases_per_row: 61 };
		const frame = opened(long, options);
		const { map, full, half } = widthsOf(long, options);
		resized(frame, map + VIEWS_APART + full);
		scrolled(frame, scrollFor(frame, 122) + 5);
		resized(frame, map + VIEWS_APART + half);
		expect(arrangement(frame).perRow).toBe(31);
		// The half row holding 122 starts at 93; full rows come back to 122's, not 93's.
		expect(frame.pane.scrollTop).toBe(scrollFor(frame, 122));
		frame.pane.dispatchEvent(new Event("scroll"));
		resized(frame, map + VIEWS_APART + full);
		expect(frame.pane.scrollTop).toBe(scrollFor(frame, 122));
		resized(frame, half / 2);
		expect(frame.pane.scrollTop).toBeCloseTo(scrollFor(frame, 122, 0.5), 6);
		resized(frame, half / 4);
		expect(frame.pane.scrollTop).toBeCloseTo(scrollFor(frame, 122, 0.25), 6);
	});

	test("keeping the selection across full rows and half, in the drawing shown", () => {
		const frame = opened(long, { sequence_view: true });
		const { map, full, half } = widthsOf(long);
		resized(frame, map + VIEWS_APART + full);
		const lacZ = frame.box.querySelector("[data-molviz-item]");
		if (!lacZ) throw new Error("no item on the map");
		click(lacZ);
		const shaded = () =>
			frame.sequence()?.svg.querySelectorAll("rect[fill='#bbddf5']").length;
		expect(shaded()).toBe(1);
		resized(frame, map + VIEWS_APART + half);
		const svg = frame.pane.querySelector("svg");
		expect(frame.sequence()?.svg).toBe(svg);
		expect(shaded()).toBe(2);
		expect(
			svg?.querySelectorAll("[data-molviz-selected]").length,
		).toBeGreaterThan(0);
		expect(frame.paneBar.querySelector("output")?.textContent).toBe(
			"11 .. 60 (50 bp)",
		);
	});

	test("again after a redraw, as a flip changes the map's width", () => {
		const frame = opened({ ...long, circular: true }, { sequence_view: true });
		const circle = widthsOf({ ...long, circular: true });
		const line = widthsOf({ ...long, circular: true }, { map: "line" });
		expect(line.map).toBeGreaterThan(circle.map);
		resized(frame, circle.map + VIEWS_APART + circle.full);
		expect(arrangement(frame)).toEqual({ beside: true, perRow: 60 });
		input(frame, "line").click();
		expect(arrangement(frame)).toEqual({ beside: true, perRow: 30 });
		input(frame, "sequence").click();
		expect(arrangement(frame)).toEqual({ beside: false, perRow: 0 });
	});
});

/** The rules the frames' style holds for print, by their selector. */
function printRules(): Map<string, CSSStyleDeclaration> {
	const style = document.getElementById("molviz-frame") as HTMLStyleElement;
	const rules = new Map<string, CSSStyleDeclaration>();
	for (const rule of style.sheet?.cssRules ?? []) {
		if (!(rule instanceof CSSMediaRule) || rule.media.mediaText !== "print") {
			continue;
		}
		for (const inner of rule.cssRules) {
			if (inner instanceof CSSStyleRule) {
				rules.set(inner.selectorText, inner.style);
			}
		}
	}
	return rules;
}

describe("printing", () => {
	test("hides both bars, and the hover box were it showing", () => {
		const frame = opened(circular, { sequence_view: true });
		const bars = [...printRules()].filter(
			([selector, style]) =>
				[frame.bar, frame.paneBar].every((bar) => bar.matches(selector)) &&
				style.display === "none",
		);
		expect(bars).toHaveLength(1);
		rest(frame);
		const shown = hoverBoxOf();
		expect(shown).not.toBeNull();
		const hidden = [...printRules()].filter(
			([selector, style]) =>
				shown?.matches(selector) && style.display === "none",
		);
		expect(hidden).toHaveLength(1);
	});

	test("lays a zoomed map out at 1×, turned as shown, and zooms it back after", () => {
		const frame = opened(circular);
		frame.shown().turn = 30;
		frame.redraw();
		const turned = frame.box.innerHTML;
		frame.shown().zoom = 2;
		frame.redraw();
		const zoomed = frame.box.innerHTML;
		frame.box.scrollLeft = 30;
		frame.box.scrollTop = 40;
		window.dispatchEvent(new Event("beforeprint"));
		expect(frame.box.innerHTML).toBe(turned);
		window.dispatchEvent(new Event("afterprint"));
		expect(frame.box.innerHTML).toBe(zoomed);
		expect([frame.box.scrollLeft, frame.box.scrollTop]).toEqual([30, 40]);
		expect(frame.shown().zoom).toBe(2);
	});

	test("leaves a map at 1× as it is", () => {
		const frame = opened(circular);
		const svg = frame.box.firstElementChild;
		window.dispatchEvent(new Event("beforeprint"));
		window.dispatchEvent(new Event("afterprint"));
		expect(frame.box.firstElementChild).toBe(svg);
	});

	test("shows the whole map and view, their boxes neither scrolling nor keeping a size", () => {
		opened(circular);
		const box = printRules().get(".molviz .map, .molviz .sequence");
		expect(box?.overflow).toBe("visible");
		expect(box?.maxHeight).toBe("none");
		expect([box?.width, box?.height]).toEqual(["auto", "auto"]);
		expect(box?.getPropertyPriority("width")).toBe("important");
	});

	test("lays the view out under the map, with full rows at full size and the selection, then back", () => {
		const frame = opened(long, { sequence_view: true });
		const { map, half } = widthsOf(long);
		resized(frame, map + VIEWS_APART + half);
		const lacZ = frame.box.querySelector("[data-molviz-item]");
		if (!lacZ) throw new Error("no item on the map");
		click(lacZ);
		const shaded = () =>
			frame.sequence()?.svg.querySelectorAll("rect[fill='#bbddf5']").length;
		window.dispatchEvent(new Event("beforeprint"));
		expect(arrangement(frame)).toEqual({ beside: false, perRow: 60 });
		expect(shaded()).toBe(1);
		window.dispatchEvent(new Event("afterprint"));
		expect(arrangement(frame)).toEqual({ beside: true, perRow: 30 });
		expect(shaded()).toBe(2);
		resized(frame, half / 2);
		window.dispatchEvent(new Event("beforeprint"));
		expect(frame.sequence()?.svg.style.width).toBe("");
		window.dispatchEvent(new Event("afterprint"));
		expect(parseFloat(frame.sequence()?.svg.style.width ?? "")).toBeCloseTo(
			half / 2,
			6,
		);
	});
});

test("destroy removes the frame and leaves the styles for another", () => {
	const element = spot();
	const frame = openFrame(
		element,
		check(linear),
		checkOptions({}, check(linear), { page: true }),
	);
	opened(linear);
	frame.destroy();
	frame.destroy();
	expect(element.children).toHaveLength(0);
	expect(document.querySelectorAll(".molviz")).toHaveLength(1);
	expect(document.querySelectorAll("#molviz-frame")).toHaveLength(1);
});

test("beforePaint runs once before the next paint, however often asked", async () => {
	let runs = 0;
	const ask = beforePaint(window, () => runs++);
	ask();
	ask();
	ask();
	expect(runs).toBe(0);
	await nextPaint();
	expect(runs).toBe(1);
	ask();
	await nextPaint();
	expect(runs).toBe(2);
});
