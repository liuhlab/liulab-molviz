// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { draw } from "../../src/viewer/draw";
import { checkOptions } from "../../src/viewer/options";
import { displayScale, openPage } from "../../src/viewer/page";
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

/** `record` opened on a page with `options`, as `draw` opens it. */
function opened(record: unknown, options: unknown = {}) {
	const checked = check(record);
	return openPage(
		spot(),
		checked,
		checkOptions(options, checked, { page: true }),
	);
}

/** The map's drawing `draw` puts on a fresh page for `record` and `options`. */
function mapOf(record: unknown, options: unknown = {}): string {
	const element = spot();
	draw(element, record, options);
	const svg = element.querySelector(".map svg");
	if (!svg) throw new Error("no map drawn");
	return svg.outerHTML;
}

function input(page: { bar: HTMLElement }, value: string): HTMLInputElement {
	const found = page.bar.querySelector<HTMLInputElement>(
		`input[value="${value}"]`,
	);
	if (!found) throw new Error(`no ${value} in the bar`);
	return found;
}

/** The value of each input in the bar's views, as the reader sees them in order. */
function views(page: { bar: HTMLElement }): string[] {
	return [...page.bar.querySelectorAll<HTMLInputElement>(".views input")].map(
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

describe("a record's page", () => {
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
		const page = opened(circular, { map: "line", sequence_view: true });
		expect(input(page, "circle").checked).toBe(false);
		expect(input(page, "line").checked).toBe(true);
		expect(input(page, "sequence").checked).toBe(true);
	});
});

describe("flipping the map", () => {
	test("draws the map flipped to as a page opening on it does", () => {
		const page = opened(circular);
		input(page, "line").click();
		expect(page.state.options.map).toBe("line");
		expect(page.box.innerHTML).toBe(mapOf(circular, { map: "line" }));
		input(page, "circle").click();
		expect(page.box.innerHTML).toBe(mapOf(circular));
	});

	test("keeps each map's zoom and scroll while the other shows", () => {
		const page = opened(circular);
		page.shown().zoom = 2;
		page.redraw();
		const zoomed = page.box.innerHTML;
		expect(zoomed).not.toBe(mapOf(circular));
		page.box.scrollLeft = 30;
		page.box.scrollTop = 40;
		input(page, "line").click();
		expect([page.box.scrollLeft, page.box.scrollTop]).toEqual([0, 0]);
		expect(page.box.innerHTML).toBe(mapOf(circular, { map: "line" }));
		page.box.scrollLeft = 50;
		input(page, "circle").click();
		expect([page.box.scrollLeft, page.box.scrollTop]).toEqual([30, 40]);
		expect(page.box.innerHTML).toBe(zoomed);
		input(page, "line").click();
		expect([page.box.scrollLeft, page.box.scrollTop]).toEqual([50, 0]);
	});
});

describe("the sequence view's switch", () => {
	test("shows the view as a page opening with it does, and hides it again", () => {
		const page = opened(linear);
		const pane = page.box.nextElementSibling as HTMLElement;
		expect(pane.hidden).toBe(true);
		input(page, "sequence").click();
		expect(page.state.options.sequence_view).toBe(true);
		expect(pane.hidden).toBe(false);
		const fresh = spot();
		draw(fresh, linear, { sequence_view: true });
		expect(pane.innerHTML).toBe(fresh.querySelector(".sequence")?.innerHTML);
		input(page, "sequence").click();
		expect(page.state.options.sequence_view).toBe(false);
		expect(pane.hidden).toBe(true);
	});

	test("leaves the view as it is drawn when only the map changes", () => {
		const page = opened(circular, { sequence_view: true });
		const view = page.box.nextElementSibling?.firstElementChild;
		input(page, "line").click();
		page.shown().zoom = 2;
		page.redraw();
		expect(page.box.nextElementSibling?.firstElementChild).toBe(view);
	});
});

test("destroy removes the page and leaves the styles for another", () => {
	const element = spot();
	const page = openPage(
		element,
		check(linear),
		checkOptions({}, check(linear), { page: true }),
	);
	opened(linear);
	page.destroy();
	page.destroy();
	expect(element.children).toHaveLength(0);
	expect(document.querySelectorAll(".molviz")).toHaveLength(1);
	expect(document.querySelectorAll("#molviz-page")).toHaveLength(1);
});
