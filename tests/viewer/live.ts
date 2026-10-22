/** What the tests of a live page share: records opened in frames, and the hands that work them. */

import { openRecord } from "../../src/viewer/draw";
import { checkOptions } from "../../src/viewer/format/options";
import { check } from "../../src/viewer/format/record";
import type { Frame } from "../../src/viewer/page/frame";
import { hoverBox } from "../../src/viewer/page/hover";
import type { Box } from "../../src/viewer/scene";
import { toElement } from "../../src/viewer/svg";
import { layoutMap } from "../../src/viewer/views";

/** A linear record with one feature. */
export const linear = {
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

/** `linear`, circular. */
export const circular = { ...linear, name: "pRing", circular: true };

/** An empty element added to the page. */
export function spot(): HTMLElement {
	const element = document.createElement("div");
	document.body.append(element);
	return element;
}

/**
 * `record` opened with `options` in a frame on the page, as `draw` opens it: the map, the
 * sequence view if the options show it, and every control, the switches with the zoom and the
 * turn.
 */
export function opened(record: unknown, options: unknown = {}): Frame {
	const checked = check(record);
	return openRecord(
		spot(),
		checked,
		checkOptions(options, checked, { page: true }),
	);
}

/** The input in `frame`'s bar, or its pane's, holding `value`. */
export function input(frame: Frame, value: string): HTMLInputElement {
	const found = frame.box.parentElement?.querySelector<HTMLInputElement>(
		`.bar input[value="${value}"]`,
	);
	if (!found) throw new Error(`no ${value} in the bars`);
	return found;
}

/** A wheel over `frame`'s map, and whether the frame kept the browser from scrolling. */
export function wheel(frame: Frame, init: WheelEventInit): boolean {
	const event = new WheelEvent("wheel", { cancelable: true, ...init });
	// happy-dom's WheelEvent is no MouseEvent, as a browser's is.
	const mouse = { ctrlKey: false, metaKey: false, clientX: 0, clientY: 0 };
	for (const [key, value] of Object.entries({ ...mouse, ...init })) {
		if (key in mouse) Object.defineProperty(event, key, { value });
	}
	frame.box.dispatchEvent(event);
	return event.defaultPrevented;
}

/** Wait for the next paint, after which a frame has laid out what its controls asked. */
export function nextPaint(): Promise<void> {
	return new Promise((done) => requestAnimationFrame(() => done()));
}

/**
 * The map `frame` shows, as a fresh layout at `view` draws it with its hovers in the page's box,
 * over `extent` if given.
 */
export function laidOut(
	frame: Frame,
	view: { readonly zoom?: number; readonly turn?: number } = {},
	extent?: Box,
): string {
	const scene = layoutMap(frame.record, frame.state.options, view);
	const svg = toElement(extent ? { ...scene, extent } : scene, document);
	hoverBox(svg);
	return svg.outerHTML;
}

/** The page's hover box, or null before anything shows in it. */
export function hoverBoxOf(): HTMLElement | null {
	return document.querySelector<HTMLElement>("body > div:not(:has(svg))");
}

/** Rest the pointer on the first shape of `frame`'s map with a hover. */
export function rest(frame: Frame): void {
	frame.box
		.querySelector("[data-molviz-hover]")
		?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
}
