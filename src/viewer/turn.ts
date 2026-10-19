/** Turning a frame's circle with the wheel, as SeqViz turns its own. */

import type { Frame } from "./frame";
import { eachFrame, pixels, redrawKeeping, type Wheel } from "./zoom";

/** How far the circle turns for each CSS pixel the wheel moves, in degrees. */
const RATE = 0.072;

/**
 * How far `wheel` turns the circle clockwise, in degrees, in a box `height` CSS pixels tall. Wheel
 * down turns it counter-clockwise.
 */
export function turnBy(wheel: Wheel, height: number): number {
	return -RATE * pixels(wheel, height);
}

/**
 * Turn `frame`'s circle with a plain wheel over it, the ring kept in place. Ctrl or ⌘ with the wheel
 * zooms instead, and a sideways swipe scrolls the box.
 */
export function addTurn(frame: Frame): void {
	const { box } = frame;
	let by = 0;
	const soon = eachFrame(box.ownerDocument.defaultView, () => {
		const turned = by;
		by = 0;
		if (frame.state.options.map !== "circle") return;
		// A turn moves no place of the map, so any spot stays put.
		const spot = { x: 0, y: 0 };
		redrawKeeping(
			frame,
			spot,
			() => {
				frame.state.maps.circle.turn += turned;
			},
			true,
		);
	});
	box.addEventListener(
		"wheel",
		(event) => {
			if (event.ctrlKey || event.metaKey) return;
			if (frame.state.options.map !== "circle") return;
			if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
			event.preventDefault();
			by += turnBy(event, box.clientHeight);
			soon();
		},
		{ passive: false },
	);
}
