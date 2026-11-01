/**
 * An input laid out, and written as SVG text with no DOM: as a file, every letter an outline,
 * with its PDF pages, or as a still drawing, with real text.
 */

import { boxOf } from "./bounds";
import { type Hidden, notice } from "./labels";
import { type Box, moved, type Scene, type Shape } from "./scene";
import { toStill, toSvg } from "./svg";

/** Where an input is laid out: for a `page`, or else for a file. */
export interface Where {
	readonly page: boolean;
}

/** An input laid out, as each writer takes it. */
export interface Layout {
	/** The whole drawing. */
	readonly scene: Scene;
	/** One scene per PDF page, or null when the whole drawing is the one page. */
	readonly pages: readonly Scene[] | null;
	/** The labels left out because they would overlap. */
	readonly hidden: readonly Hidden[];
}

/** One input, as the input table holds it: how to check it and its options, and how to lay it out. */
export interface Input<T> {
	/** Return `input` typed, or throw one FormatError naming every problem by its path. */
	check(input: unknown): T;
	/**
	 * Throw one FormatError naming every problem in `options` for laying `input` out as `where`
	 * says, as `layout` would, without laying out. Absent where the options are ignored.
	 */
	checkOptions?(input: T, options: unknown, where: Where): void;
	/**
	 * Lay `input` out with `options`, for a page or a file as `where` says. Throws one
	 * FormatError naming every problem in the options.
	 */
	layout(input: T, options: unknown, where: Where): Layout;
}

/** What each call that draws as SVG text returns. */
export interface Drawing {
	/** The whole drawing. Its width and height have no unit: one unit is one point. */
	readonly svg: string;
	/** One SVG per PDF page, the map first. */
	readonly pages: readonly string[];
	/** The labels left out because they would overlap, each counted in the notice. */
	readonly hidden: readonly Hidden[];
	/** The hidden-label notice as a sentence, empty when nothing hides. */
	readonly notice: string;
}

/**
 * What each call that draws a still SVG returns. Its SVG is laid out as the file's, with each
 * text a `<text>` and each hover a `<title>`; it draws in the viewer's faces only on a page that
 * holds the font rules.
 */
export type Still = Omit<Drawing, "pages">;

/** `layout` as SVG text, every letter an outline, with its PDF pages. */
export function fileDrawing({ scene, pages, hidden }: Layout): Drawing {
	const svg = toSvg(scene);
	return {
		svg,
		hidden,
		notice: notice(hidden),
		pages: pages === null ? [svg] : pages.map(toSvg),
	};
}

/** `layout` as a still SVG. */
export function stillDrawing({ scene, hidden }: Layout): Still {
	return { svg: toStill(scene), hidden, notice: notice(hidden) };
}

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
export function rowPages(
	view: Scene & { readonly rows: readonly Box[] },
): Scene[] {
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
