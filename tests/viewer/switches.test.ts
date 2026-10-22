// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from "vitest";
import { displayScale, type Frame } from "../../src/viewer/frame";
import { draw, svg } from "../../src/viewer/index";
import ap1File from "../records/ap1-product.json";
import trace from "../records/trace-3730.json";
import { input, opened } from "./live";

/** AP-1 with every enzyme it holds on, so its circle hides six cut sites. */
const ap1 = [
	ap1File,
	{ enzymes: [...new Set(ap1File.cuts.map(({ enzyme }) => enzyme))] },
] as const;

const record = {
	name: "pTest",
	circular: true,
	bases: "ACGT".repeat(25),
	features: [
		{
			name: "ori",
			type: "rep_origin",
			strand: 1,
			segments: [{ start: 2, end: 20 }],
		},
		{
			name: "lacZ",
			type: "CDS",
			strand: 1,
			segments: [{ start: 30, end: 60 }],
		},
		{
			name: "Plac",
			type: "promoter",
			strand: 1,
			segments: [{ start: 22, end: 28 }],
		},
		{ name: "rbs", type: "RBS", strand: 1, segments: [{ start: 26, end: 29 }] },
		{
			name: "whole",
			type: "source",
			strand: 0,
			segments: [{ start: 0, end: 100 }],
		},
	],
	insertions: [{ name: "ins", at: 70, length: 3 }],
	cuts: [
		{ enzyme: "BsaI", start: 8, end: 14, at: 15, stagger: 4 },
		{ enzyme: "NcoI", start: 32, end: 38, at: 33, stagger: 4 },
		{ enzyme: "BsaI", start: 48, end: 54, at: 55, stagger: 4 },
		{ enzyme: "EcoRI", start: 80, end: 86, at: 81, stagger: 4 },
	],
};

/** Each switch in the fieldset `name` as the reader sees it: its text, and a tick if on. */
function ticks(frame: Frame, name: string): string[] {
	const set = frame.bar.querySelector(`fieldset[aria-label="${name}"]`);
	if (!set) throw new Error(`no ${name} in the bar`);
	return [...set.querySelectorAll("label")].map((label) => {
		const input = label.querySelector("input");
		return `${input?.checked ? "x" : " "} ${label.textContent}`;
	});
}

/** Each text the map draws, without its hover. */
function texts(frame: Frame): string[] {
	return [...frame.box.querySelectorAll("text")].map((text) =>
		[...text.childNodes]
			.filter((node) => node.nodeType === node.TEXT_NODE)
			.map((node) => node.textContent)
			.join(""),
	);
}

/** The hidden-label notice on the map, or nothing. */
function notice(frame: Frame): string {
	return texts(frame).find((text) => text.endsWith(" hidden")) ?? "";
}

afterEach(() => {
	document.head.replaceChildren();
	document.body.replaceChildren();
});

describe("the switches", () => {
	test("switch each kind the record holds, ticked unless the options start it off", () => {
		const frame = opened(record, { kinds_off: ["insertions"] });
		expect(ticks(frame, "Kinds")).toEqual([
			"x Features",
			"x Cut sites",
			"  Insertions",
		]);
	});

	test("switch each feature type the record holds, in order whatever their case", () => {
		const frame = opened(record, {
			types_off: ["source", "gene", "rep_origin"],
		});
		expect(ticks(frame, "Feature types")).toEqual([
			"x CDS",
			"x promoter",
			"x RBS",
			"  rep_origin",
			"  source",
		]);
	});

	test("fold every enzyme the record holds into a list, with its cuts, the unique cutters bold", () => {
		const frame = opened(record);
		expect(frame.bar.querySelector("summary")?.textContent).toBe(
			"Enzymes (2 of 3)",
		);
		expect(ticks(frame, "Enzymes")).toEqual([
			"  BsaI (2)",
			"x EcoRI (1)",
			"x NcoI (1)",
		]);
		const bold = frame.bar.querySelectorAll("fieldset[aria-label=Enzymes] b");
		expect([...bold].map((b) => b.textContent)).toEqual(["EcoRI", "NcoI"]);
	});

	test("tick the enzymes the options name, whatever their case", () => {
		const frame = opened(record, { enzymes: ["bsai", "SmaI"] });
		expect(ticks(frame, "Enzymes")).toEqual([
			"x BsaI (2)",
			"  EcoRI (1)",
			"  NcoI (1)",
		]);
		expect(frame.bar.querySelector("summary")?.textContent).toBe(
			"Enzymes (1 of 3)",
		);
	});
});

describe("a change", () => {
	test("to a kind lays the map out again, showing the labels it frees", () => {
		const frame = opened(...ap1);
		expect(notice(frame)).toBe("6 cut sites are hidden");
		expect(texts(frame)).not.toContain("BtgZI (1864)");
		input(frame, "features").click();
		expect(frame.state.options.kinds_off).toEqual(["features"]);
		expect(notice(frame)).toBe("");
		expect(texts(frame)).toEqual(
			expect.arrayContaining(["BtgZI (1864)", "BspQI - SapI (2295)"]),
		);
	});

	test("to a feature type lays the map out again", () => {
		const frame = opened(...ap1);
		input(frame, "RBS").click();
		expect(frame.state.options.types_off).toEqual(["source", "RBS"]);
		expect(notice(frame)).toBe("2 cut sites are hidden");
		input(frame, "RBS").click();
		expect(frame.state.options.types_off).toEqual(["source"]);
		expect(notice(frame)).toBe("6 cut sites are hidden");
	});

	test("to an enzyme lays the map out again and recounts the list", () => {
		const frame = opened(...ap1);
		input(frame, "BtgZI").click();
		expect(frame.state.options.enzymes).not.toContain("BtgZI");
		expect(frame.state.options.enzymes).toHaveLength(13);
		expect(notice(frame)).toBe("2 cut sites are hidden");
		expect(frame.bar.querySelector("summary")?.textContent).toBe(
			"Enzymes (13 of 14)",
		);
	});

	test("to a kind lays the sequence view out again too", () => {
		const frame = opened(record, { sequence_view: true });
		const before = frame.box.nextElementSibling?.innerHTML;
		input(frame, "features").click();
		expect(frame.box.nextElementSibling?.innerHTML).not.toBe(before);
		const fresh = document.createElement("div");
		draw(fresh, record, { sequence_view: true, kinds_off: ["features"] });
		expect(frame.box.nextElementSibling?.innerHTML).toBe(
			fresh.querySelector(".sequence")?.innerHTML,
		);
	});

	test("while zoomed sizes the map's box, and its scale, to the new layout at 1×", () => {
		const room = 400;
		const fresh = opened(ap1[0], { ...ap1[1], kinds_off: ["features"] });
		const size = fresh.drawn().extent;
		const frame = opened(...ap1);
		const root = frame.box.parentElement as HTMLElement;
		Object.defineProperty(root, "clientWidth", { value: room });
		frame.shown().zoom = 2;
		frame.redraw();
		input(frame, "features").click();
		const scale = displayScale(size.width, room);
		expect(frame.drawn().scale).toBe(scale);
		const { width, height } = frame.box.style;
		expect(parseFloat(width)).toBeCloseTo(size.width * scale, 6);
		expect(parseFloat(height)).toBeCloseTo(size.height * scale, 6);
	});

	test("to Sequence shows the Tracks switch, as only the sequence view draws tracks", () => {
		const frame = opened(trace);
		const tracks = input(frame, "tracks").closest("label");
		expect(tracks?.hidden).toBe(true);
		input(frame, "sequence").click();
		expect(tracks?.hidden).toBe(false);
		input(frame, "sequence").click();
		expect(tracks?.hidden).toBe(true);
	});

	test("to Cut sites greys the enzymes while it is off, and to Features the types", () => {
		const frame = opened(record, { kinds_off: ["cuts"] });
		const set = (name: string) =>
			frame.bar.querySelector<HTMLFieldSetElement>(
				`fieldset[aria-label="${name}"]`,
			);
		expect(set("Enzymes")?.disabled).toBe(true);
		expect(set("Feature types")?.disabled).toBe(false);
		input(frame, "cuts").click();
		input(frame, "features").click();
		expect(set("Enzymes")?.disabled).toBe(false);
		expect(set("Feature types")?.disabled).toBe(true);
	});
});

describe("Both strands", () => {
	/**
	 * The sequence view's drawing in `frame`, and whether what it draws with both strands and
	 * what it draws with the top one alone shows.
	 */
	const sequence = (frame: Frame) => {
		// happy-dom keeps an element's computed style when an ancestor's class changes; a copy's
		// is fresh.
		const copy = frame.pane.cloneNode(true) as HTMLElement;
		frame.pane.after(copy);
		const seen = (selector: string) =>
			new Set(
				[...copy.querySelectorAll(selector)].map((one) =>
					getComputedStyle(one).display === "none" ? "hidden" : "shown",
				),
			);
		const strands = { both: seen(".molviz-both"), top: seen(".molviz-top") };
		copy.remove();
		return { svg: frame.pane.querySelector("svg"), ...strands };
	};
	const one = { both: new Set(["hidden"]), top: new Set(["shown"]) };
	const two = { both: new Set(["shown"]), top: new Set(["hidden"]) };

	test("starts from the options, the view laid out with both strands and the bottom one hidden", () => {
		const frame = opened(record, { sequence_view: true, bottom_strand: false });
		expect(frame.state.options.bottom_strand).toBe(false);
		expect(input(frame, "both").checked).toBe(false);
		expect(sequence(frame)).toMatchObject(one);
	});

	test("shows and hides the bottom strand, laying nothing out again", () => {
		const frame = opened(record, { sequence_view: true });
		const before = sequence(frame);
		const map = frame.box.querySelector("svg");
		expect(before).toMatchObject(two);
		input(frame, "both").click();
		expect(frame.state.options.bottom_strand).toBe(false);
		expect(sequence(frame)).toMatchObject({ ...one, svg: before.svg });
		expect(frame.box.querySelector("svg")).toBe(map);
		input(frame, "both").click();
		expect(frame.state.options.bottom_strand).toBe(true);
		expect(sequence(frame)).toMatchObject(two);
	});

	test("is left out of what lays the view out again, which keeps it", () => {
		const frame = opened(record, { sequence_view: true });
		const before = sequence(frame).svg;
		input(frame, "both").click();
		input(frame, "line").click();
		expect(sequence(frame).svg).toBe(before);
		input(frame, "features").click();
		expect(sequence(frame).svg).not.toBe(before);
		expect(sequence(frame)).toMatchObject(one);
	});

	test("sits first in the sequence view's bar, hidden with it", () => {
		const frame = opened(record);
		const both = input(frame, "both");
		expect(frame.paneBar.firstElementChild?.contains(both)).toBe(true);
		expect(frame.pane.hidden).toBe(true);
		input(frame, "sequence").click();
		expect(frame.pane.hidden).toBe(false);
	});
});

describe("a frame", () => {
	/** The name of each set of controls in the bar, in order. */
	const sets = (bar: Element) =>
		[...bar.children].map(
			(set) =>
				set.getAttribute("aria-label") ??
				set.querySelector("fieldset")?.getAttribute("aria-label"),
		);

	test("opens on what a file with the same options draws", () => {
		const frame = opened(...ap1);
		const file = svg(...ap1);
		expect(notice(frame)).toBe(file.notice);
		expect(frame.redraw().hidden).toEqual(file.hidden);
	});

	test("from draw holds its switches left of the views", () => {
		const element = document.createElement("div");
		draw(element, record);
		const bar = element.querySelector(".bar");
		if (!bar) throw new Error("no bar");
		expect(sets(bar)).toEqual(["Kinds", "Feature types", "Enzymes", "Views"]);
	});

	test("offers no switch for what the record lacks", () => {
		const { cuts, ...uncut } = record;
		expect(sets(opened(uncut).bar)).toEqual([
			"Kinds",
			"Feature types",
			"Views",
		]);
		const bare = { name: "bare", circular: false, bases: "ACGT" };
		expect(sets(opened(bare).bar)).toEqual(["Views"]);
	});
});
