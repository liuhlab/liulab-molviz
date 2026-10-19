/**
 * Zooming a frame's map from 1× to 8×: a slider and Reset in the bar, and Ctrl or ⌘ with the
 * wheel about the pointer.
 */

import type { Frame } from "./frame";
import type { Options } from "./options";
import type { Box } from "./scene";

/** The most a map zooms, in doublings: 8×. */
const MOST = 3;

/** A place in a map's box, in CSS pixels from its top left as it shows. */
export interface Spot {
	readonly x: number;
	readonly y: number;
}

/** The part of a wheel event that moves up or down. */
export type Wheel = Pick<WheelEvent, "deltaY" | "deltaMode">;

/** How far `wheel` moves, in CSS pixels down: a line is 16 of them, a frame a box's `height`. */
export function pixels({ deltaY, deltaMode }: Wheel, height: number): number {
	return deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? height : 1);
}

/**
 * How many doublings `wheel` zooms in, in a box `height` CSS pixels tall: a pinch by its own scale,
 * a wheel's notch half a doubling at most.
 */
export function zoomBy(wheel: Wheel, height: number): number {
	const by = -pixels(wheel, height) / 100 / Math.LN2;
	return Math.min(Math.max(by, -0.5), 0.5);
}

/**
 * Where to scroll a map's box so the spot `at` in it stays over the same place of the map, when
 * the map laid out over `before` is laid out `by` times as large over `after`. The circle grows
 * about its centre, the line only along its length. The map showed `scale` CSS pixels to a point
 * and shows `rescaled`, by default the same, and the box was scrolled to `left` and `top`.
 */
export function anchored(
	map: Options["map"],
	before: Box,
	after: Box,
	{
		scale,
		rescaled = scale,
		at,
		left,
		top,
		by,
	}: {
		readonly scale: number;
		readonly rescaled?: number;
		readonly at: Spot;
		readonly left: number;
		readonly top: number;
		readonly by: number;
	},
): { left: number; top: number } {
	const x = (before.x + (left + at.x) / scale) * by;
	const y = (before.y + (top + at.y) / scale) * (map === "circle" ? by : 1);
	return {
		left: (x - after.x) * rescaled - at.x,
		top: (y - after.y) * rescaled - at.y,
	};
}

/**
 * The middle of what shows of a drawing `width` by `height` CSS pixels, in a box `sight` big
 * scrolled to `left` and `top`.
 */
export function middle(
	width: number,
	height: number,
	sight: { readonly width: number; readonly height: number },
	left: number,
	top: number,
): Spot {
	return {
		x: Math.min(sight.width, width - left) / 2,
		y: Math.min(sight.height, height - top) / 2,
	};
}

/**
 * `run` in the next frame, once however often the function returned is called before then; at
 * once where there are no frames.
 */
export function eachFrame(view: Window | null, run: () => void): () => void {
	let asked = false;
	const go = () => {
		asked = false;
		run();
	};
	return () => {
		if (asked) return;
		asked = true;
		if (view) view.requestAnimationFrame(go);
		else go();
	};
}

/**
 * Change `frame`'s state with `change`, lay its map out again, and scroll its box so the spot `at`
 * stays over the same place of the map. With `hold`, the map's box takes in the one before.
 */
export function redrawKeeping(
	frame: Frame,
	at: Spot,
	change: () => void,
	hold = false,
): void {
	const { extent: before, scale } = frame.drawn();
	const from = frame.shown().zoom;
	change();
	const { box } = frame;
	const scroll = anchored(
		frame.state.options.map,
		before,
		frame.redraw(hold).extent,
		{
			scale,
			rescaled: frame.drawn().scale,
			at,
			left: box.scrollLeft,
			top: box.scrollTop,
			by: frame.shown().zoom / from,
		},
	);
	box.scrollLeft = scroll.left;
	box.scrollTop = scroll.top;
}

/**
 * Add the zoom to the right of `frame`'s bar: a slider in doublings and Reset, and Ctrl or ⌘ with
 * the wheel over the map.
 */
export function addZoom(frame: Frame): void {
	const { bar, box } = frame;
	const document = box.ownerDocument;
	const slider = document.createElement("input");
	slider.type = "range";
	slider.min = "0";
	slider.max = String(MOST);
	slider.step = "any";
	slider.value = "0";
	const label = document.createElement("label");
	label.append("Zoom", slider);
	const reset = document.createElement("button");
	reset.type = "button";
	reset.textContent = "Reset";
	const set = document.createElement("fieldset");
	set.className = "zoom";
	set.setAttribute("aria-label", "Zoom");
	set.append(label, reset);
	// The views and the zoom wrap together, at the bar's right.
	const end = document.createElement("div");
	end.className = "end";
	end.append(...bar.querySelectorAll(".views"), set);
	bar.append(end);

	let asked: { level: number; at: Spot } | null = null;
	const soon = eachFrame(document.defaultView, () => {
		if (asked === null) return;
		const { level, at } = asked;
		asked = null;
		redrawKeeping(frame, at, () => {
			frame.shown().zoom = 2 ** level;
		});
		slider.value = String(level);
	});
	const zoomTo = (level: number, at: Spot) => {
		asked = { level: Math.min(Math.max(level, 0), MOST), at };
		soon();
	};

	slider.addEventListener("input", () => {
		const { extent, scale } = frame.drawn();
		const at = middle(
			extent.width * scale,
			extent.height * scale,
			{ width: box.clientWidth, height: box.clientHeight },
			box.scrollLeft,
			box.scrollTop,
		);
		zoomTo(slider.valueAsNumber, at);
	});
	box.addEventListener(
		"wheel",
		(event) => {
			if (!(event.ctrlKey || event.metaKey)) return;
			event.preventDefault();
			const level = asked?.level ?? Math.log2(frame.shown().zoom);
			const { left, top } = box.getBoundingClientRect();
			zoomTo(level + zoomBy(event, box.clientHeight), {
				x: event.clientX - left,
				y: event.clientY - top,
			});
		},
		{ passive: false },
	);
	reset.addEventListener("click", () => {
		asked = null;
		const map = frame.shown();
		map.zoom = 1;
		map.turn = 0;
		frame.redraw();
		box.scrollLeft = 0;
		box.scrollTop = 0;
		slider.value = "0";
	});
	// A flip shows the other map at its own zoom.
	bar.addEventListener("change", (event) => {
		if (event.target === slider) return;
		asked = null;
		slider.value = String(Math.log2(frame.shown().zoom));
	});
}
