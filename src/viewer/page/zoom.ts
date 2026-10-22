/**
 * Zooming a frame's map from 1× to 8×: a slider and Reset in the bar, and Ctrl or ⌘ with the
 * wheel about the pointer.
 */

import {
	beforePaint,
	type Frame,
	fieldset,
	pixels,
	redrawKeeping,
	type Spot,
	type Wheel,
} from "./frame";

/** The most a map zooms, in doublings: 8×. */
const MOST = 3;

/**
 * How many doublings `wheel` zooms in, in a box `height` CSS pixels tall: a pinch by its own scale,
 * a wheel's notch half a doubling at most.
 */
export function zoomBy(wheel: Wheel, height: number): number {
	const by = -pixels(wheel, height) / 100 / Math.LN2;
	return Math.min(Math.max(by, -0.5), 0.5);
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
	const set = fieldset(document, "Zoom", [label, reset], "zoom");
	// The views and the zoom wrap together, at the bar's right.
	const end = document.createElement("div");
	end.className = "end";
	end.append(...bar.querySelectorAll(".views"), set);
	bar.append(end);

	let asked: { level: number; at: Spot } | null = null;
	const soon = beforePaint(document.defaultView, () => {
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
		frame.reset();
		slider.value = "0";
	});
	// A flip shows the other map at its own zoom.
	bar.addEventListener("change", (event) => {
		if (event.target === slider) return;
		asked = null;
		slider.value = String(Math.log2(frame.shown().zoom));
	});
}
