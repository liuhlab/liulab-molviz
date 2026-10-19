/** A map with its sequence view under it, as a file draws them, and the view cut into PDF pages. */

import { boxOf } from "./line";
import { type Box, moved, type Scene, type Shape } from "./scene";
import type { SequenceScene } from "./sequence";

/** `under` set below `top`, the narrower centred on the wider, their extents touching. */
export function stacked(top: Scene, under: Scene): Scene {
	const a = top.extent;
	const b = under.extent;
	const width = Math.max(a.width, b.width);
	const left = a.x - (width - a.width) / 2;
	const dx = left + (width - b.width) / 2 - b.x;
	const dy = a.y + a.height - b.y;
	return {
		extent: { x: left, y: a.y, width, height: a.height + b.height },
		shapes: [...top.shapes, ...under.shapes.map((s) => moved(s, dx, dy))],
	};
}

/**
 * The sequence view as PDF pages, each as wide as the view and holding whole rows, as many as
 * fit in √2 times that width with the view's margin around them. A row taller than that stands
 * alone.
 */
export function rowPages(view: SequenceScene): Scene[] {
	const { extent, rows } = view;
	const margin = rows[0].y - extent.y;
	const tall = extent.width * Math.SQRT2;
	const groups: Box[][] = [];
	for (const row of rows) {
		const page = groups.at(-1);
		if (page && bottom(row) + margin - (page[0].y - margin) <= tall) {
			page.push(row);
		} else {
			groups.push([row]);
		}
	}
	// A shape is on the page whose rows hold its middle, cut halfway between the pages' rows.
	const cuts = groups
		.slice(1)
		.map((page, i) => (bottom(groups[i].at(-1) as Box) + page[0].y) / 2);
	const shapes = groups.map((): Shape[] => []);
	for (const shape of view.shapes) {
		const y = middle(shape);
		let page = 0;
		while (page < cuts.length && y >= cuts[page]) page++;
		shapes[page].push(shape);
	}
	return groups.map((page, i) => {
		const top = page[0].y - margin;
		return {
			extent: {
				x: extent.x,
				y: top,
				width: extent.width,
				height: bottom(page.at(-1) as Box) + margin - top,
			},
			shapes: shapes[i],
		};
	});
}

function bottom(box: Box): number {
	return box.y + box.height;
}

/** How far down the middle of `shape` lies. */
function middle(shape: Shape): number {
	if (shape.shape === "line") return (shape.y1 + shape.y2) / 2;
	const box = boxOf(shape);
	return box ? box.y + box.height / 2 : 0;
}
