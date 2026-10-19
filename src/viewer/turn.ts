/** Turning a page's circle with the wheel, as SeqViz turns its own. */

import type { Page } from "./page";
import { eachFrame, pixels, redrawKeeping, type Wheel } from "./zoom";

/** How far the circle turns for each CSS pixel the wheel moves, in degrees. */
const RATE = 0.072;

/**
 * How far `wheel` turns the circle clockwise, in degrees, in a box `page` CSS pixels tall. Wheel
 * down turns it counter-clockwise.
 */
export function turnBy(wheel: Wheel, page: number): number {
	return -RATE * pixels(wheel, page);
}

/**
 * Turn `page`'s circle with a plain wheel over it, the ring kept in place. Ctrl or ⌘ with the wheel
 * zooms instead, and a sideways swipe scrolls the box.
 */
export function addTurn(page: Page): void {
	const { box } = page;
	let by = 0;
	const soon = eachFrame(box.ownerDocument.defaultView, () => {
		const turned = by;
		by = 0;
		if (page.state.options.map !== "circle") return;
		// A turn moves no place of the map, so any spot stays put.
		const spot = { x: 0, y: 0 };
		redrawKeeping(
			page,
			spot,
			() => {
				page.state.maps.circle.turn += turned;
			},
			true,
		);
	});
	box.addEventListener(
		"wheel",
		(event) => {
			if (event.ctrlKey || event.metaKey) return;
			if (page.state.options.map !== "circle") return;
			if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
			event.preventDefault();
			by += turnBy(event, box.clientHeight);
			soon();
		},
		{ passive: false },
	);
}
