// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { draw, openRecord } from "../../src/viewer/draw";
import {
	anchored,
	beforePaint,
	displayScale,
	openFrame,
} from "../../src/viewer/frame";
import { checkOptions } from "../../src/viewer/options";
import { check } from "../../src/viewer/record";

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

function spot(): HTMLElement {
	const element = document.createElement("div");
	document.body.append(element);
	return element;
}

/** `record` opened in a frame with `options`, as `draw` opens it. */
function opened(record: unknown, options: unknown = {}) {
	const checked = check(record);
	return openRecord(
		spot(),
		checked,
		checkOptions(options, checked, { page: true }),
	);
}

/** The map's drawing `draw` puts in a fresh frame for `record` and `options`. */
function mapOf(record: unknown, options: unknown = {}): string {
	const element = spot();
	draw(element, record, options);
	const svg = element.querySelector(".map svg");
	if (!svg) throw new Error("no map drawn");
	return svg.outerHTML;
}

function input(frame: { bar: HTMLElement }, value: string): HTMLInputElement {
	const found = frame.bar.querySelector<HTMLInputElement>(
		`input[value="${value}"]`,
	);
	if (!found) throw new Error(`no ${value} in the bar`);
	return found;
}

/** The value of each input in the bar's views, as the reader sees them in order. */
function views(frame: { bar: HTMLElement }): string[] {
	return [...frame.bar.querySelectorAll<HTMLInputElement>(".views input")].map(
		(one) => one.value,
	);
}

const nextPaint = () =>
	new Promise<void>((done) => requestAnimationFrame(() => done()));

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

	test("offers no sequence view past 100,000 bases", () => {
		const long = { ...circular, bases: "ACGT".repeat(25_001) };
		expect(views(opened(long, { sequence_view: true }))).toEqual([
			"circle",
			"line",
		]);
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
		const box = document.querySelector<HTMLElement>(
			"body > div:not(:has(svg))",
		);
		expect(box?.hidden).toBe(false);
		expect(box?.firstElementChild?.textContent).toBe("lacZ");
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
		const view = frame.box.nextElementSibling?.firstElementChild;
		input(frame, "line").click();
		frame.shown().zoom = 2;
		frame.redraw();
		expect(frame.box.nextElementSibling?.firstElementChild).toBe(view);
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
	test("hides the bar, and the hover box were it showing", () => {
		const frame = opened(circular);
		expect(printRules().get(".molviz .bar")?.display).toBe("none");
		frame.box
			.querySelector("[data-molviz-hover]")
			?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
		const shown = document.querySelector("body > div:not(:has(svg))");
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

	test("shows the whole map, its box neither scrolling nor keeping its size", () => {
		opened(circular);
		const box = printRules().get(".molviz .map, .molviz .sequence");
		expect(box?.overflow).toBe("visible");
		expect([box?.width, box?.height]).toEqual(["auto", "auto"]);
		expect(box?.getPropertyPriority("width")).toBe("important");
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
