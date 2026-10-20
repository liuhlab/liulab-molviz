/** A frame's views linked: what the reader selects in either is drawn in both. */

import { aroundBoxes, boxOf } from "./bounds";
import type { Frame } from "./frame";
import { onMap, rowHolding, rowShading } from "./geometry";
import type { ClientPoint } from "./pane";
import { turns } from "./pieces";
import { type Bounds, recordBounds } from "./record";
import type { Shape } from "./scene";
import {
	clicked,
	type Drag,
	dragFrom,
	dragged,
	dragTo,
	itemSelection,
	type Selection,
} from "./selection";
import type { RowBox } from "./sequence";
import { ITEM, inPoints, SELECTED, shapeElements } from "./svg";

/** How far, in CSS pixels, a press may move and still be a click. */
const CLICK = 4;

/** Each second, a pointer past the pane's top or foot scrolls it this many times as far. */
const PACE = 20;

/** Each drawing's layer of shading, after its ground and behind everything it draws. */
const layers = new WeakMap<SVGSVGElement, SVGGElement>();

/** The item each drawing outlines, once it has outlined one or none. */
const outlines = new WeakMap<SVGSVGElement, string | null>();

/**
 * Select in `frame`'s views: an item by clicking it in either, bases by dragging across the map or
 * across the bases.
 */
export function addLinks(frame: Frame): void {
	const { record, state, box, pane, paneBar } = frame;
	const bounds = recordBounds(record);
	const window = pane.ownerDocument.defaultView;
	const select = (selection: Selection | null) => {
		if (JSON.stringify(selection) === JSON.stringify(state.selection)) return;
		state.selection = selection;
		frame.changed();
	};

	/**
	 * The press under way: where it began, on what item, and the drag it became on the map, or
	 * across bases.
	 */
	let press: {
		x: number;
		y: number;
		item: string | null;
		map: { base: number; drag: Drag | null } | null;
		bases: Drag | null;
	} | null = null;

	/** The base of the map under `event`, or null where its drawing has no place on the page. */
	const mapBase = (event: PointerEvent): number | null => {
		const { svg, geometry } = frame.map();
		const point = inPoints(svg, event);
		return point === null ? null : onMap(geometry).base(...point);
	};

	frame.onChange(() => show(frame, bounds));
	show(frame, bounds);

	/**
	 * The pane in sight, in client pixels, from its bar's foot to its own, within the window; null
	 * before layout.
	 */
	const sight = (): { top: number; bottom: number } | null => {
		const { top } = pane.getBoundingClientRect();
		const bottom = Math.min(
			top + pane.clientHeight,
			window?.innerHeight ?? Number.POSITIVE_INFINITY,
		);
		const under = Math.max(top, paneBar.getBoundingClientRect().bottom, 0);
		return bottom > under ? { top: under, bottom } : null;
	};

	/** Where the pointer was last in a drag across bases, and the frame scrolling the pane. */
	let pointer: ClientPoint | null = null;
	let gliding = 0;

	/** Take a drag across bases on to the base in sight nearest the pointer. */
	const extend = () => {
		if (!press?.bases || pointer === null) return;
		const seen = sight();
		const clientY = seen
			? Math.min(Math.max(pointer.clientY, seen.top), seen.bottom)
			: pointer.clientY;
		const base = frame.sequenceBase(
			{ clientX: pointer.clientX, clientY },
			true,
		);
		if (base === null) return;
		press.bases = dragTo(press.bases, base);
		select(dragged(press.bases, bounds));
	};

	/** Scroll the pane each frame from `then` while the pointer is past its top or foot. */
	const glide = (then: number, owed: number) => {
		gliding =
			window?.requestAnimationFrame((now) => {
				const seen = sight();
				if (pointer === null || seen === null) return;
				const y = pointer.clientY;
				const past = y < seen.top ? y - seen.top : Math.max(y - seen.bottom, 0);
				// Whole pixels, the rest owed, so that a slow scroll is not lost to rounding.
				const due = past ? owed + (past * PACE * (now - then)) / 1000 : 0;
				const step = Math.trunc(due);
				if (step) {
					pane.scrollTop += step;
					extend();
				}
				glide(now, due - step);
			}) ?? 0;
	};
	const stop = () => {
		pointer = null;
		window?.cancelAnimationFrame(gliding);
	};
	/** Scroll the pane so the row holding the selection's start sits at its top, under its bar. */
	const toRow = () => {
		const sequence = frame.sequence();
		const { selection } = state;
		const row =
			sequence && selection && rowOf(sequence.rows, selection, bounds);
		const ctm = sequence?.svg.getScreenCTM();
		if (!row || !ctm) return;
		const top = ctm.b * row.x + ctm.d * row.y + ctm.f;
		const under = Math.max(
			pane.getBoundingClientRect().top,
			paneBar.getBoundingClientRect().bottom,
		);
		pane.scrollTop += top - under;
	};

	/** Scroll a zoomed map's box to centre the selection, if it is out of sight. */
	const toMap = () => {
		const { selection } = state;
		if (selection === null || frame.shown().zoom === 1) return;
		// A point shows as the base before it, or the first.
		const spans =
			"spans" in selection
				? selection.spans
				: [
						{
							start: Math.max(selection.at - 1, 0),
							end: Math.max(selection.at, 1),
						},
					];
		const on = onMap(frame.map().geometry);
		const boxes = spans
			.flatMap((span) => on.shading(bounds, span))
			.flatMap((shape) => boxOf(shape) ?? []);
		if (!boxes.length) return;
		const area = aroundBoxes(boxes);
		const { extent, scale } = frame.drawn();
		box.scrollLeft = inSight(
			box.scrollLeft,
			box.clientWidth,
			(area.x - extent.x) * scale,
			area.width * scale,
		);
		box.scrollTop = inSight(
			box.scrollTop,
			box.clientHeight,
			(area.y - extent.y) * scale,
			area.height * scale,
		);
	};

	// A scroll under a pointer held still moves the bases under it too.
	pane.addEventListener("scroll", extend);

	for (const view of [box, pane]) {
		view.addEventListener("pointerdown", (event) => {
			const svg = drawingUnder(event);
			if (!pointing(event) || svg === null) return;
			const item = itemUnder(event);
			const onMapBase = view === box ? mapBase(event) : null;
			const onBase =
				view === pane && item === null ? frame.sequenceBase(event) : null;
			press = {
				x: event.clientX,
				y: event.clientY,
				item,
				map: onMapBase === null ? null : { base: onMapBase, drag: null },
				bases: onBase === null ? null : dragFrom(onBase),
			};
			svg.setPointerCapture(event.pointerId);
			if (press.bases) {
				svg.ownerDocument.getSelection()?.removeAllRanges();
				select(dragged(press.bases, bounds));
				pointer = event;
				glide(window?.performance.now() ?? 0, 0);
			}
		});
		view.addEventListener("pointermove", (event) => {
			if (press?.bases) {
				pointer = event;
				extend();
				return;
			}
			const map = press?.map;
			if (!press || !map) return;
			if (map.drag === null) {
				if (!pastClick(press, event)) return;
				map.drag = dragFrom(map.base);
			}
			const base = mapBase(event);
			if (base === null) return;
			map.drag = onMap(frame.map().geometry).dragTo(map.drag, base);
			select(dragged(map.drag, bounds));
		});
		view.addEventListener("pointerup", (event) => {
			const ended = press;
			press = null;
			stop();
			if (ended === null) return;
			if (!ended.bases && !ended.map?.drag) {
				if (pastClick(ended, event)) return;
				const { item } = ended;
				const picked =
					item === null
						? null
						: itemSelection(item, record, state.options.enzymes);
				select(clicked(state.selection, picked));
			}
			if (view === box) toRow();
			else toMap();
		});
		view.addEventListener("pointercancel", () => {
			press = null;
			stop();
		});
		// A press selects bases or an item, not the text they are set in.
		view.addEventListener("selectstart", (event) => {
			if (press) event.preventDefault();
		});
	}
}

/** Whether the pointer at `event` has gone farther from `press` than a click may. */
function pastClick(
	press: { readonly x: number; readonly y: number },
	event: PointerEvent,
): boolean {
	return Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK;
}

/** Whether `event` is a press, or a move, of a mouse's main button or a pen; a touch scrolls. */
function pointing(event: PointerEvent): boolean {
	return (
		(event.pointerType === "mouse" || event.pointerType === "pen") &&
		event.button === 0
	);
}

/** The drawing under `event`, or null. */
function drawingUnder(event: PointerEvent): SVGSVGElement | null {
	const target = event.target as Partial<Element> | null;
	return target?.closest?.("svg") ?? null;
}

/** The key of the item under `event`, or null. */
function itemUnder(event: PointerEvent): string | null {
	const target = event.target as Partial<Element> | null;
	return target?.closest?.(`[${ITEM}]`)?.getAttribute(ITEM) ?? null;
}

/** Draw `frame`'s selection in each view it shows: its spans shaded, its item outlined. */
function show(frame: Frame, bounds: Bounds): void {
	const { selection, options } = frame.state;
	const spans = selection && "spans" in selection ? selection.spans : [];
	const item = selection?.item ?? null;
	const map = frame.map();
	const on = onMap(map.geometry);
	shade(
		map.svg,
		spans.flatMap((span) => on.shading(bounds, span)),
	);
	outline(map.svg, item);
	const sequence = frame.sequence();
	if (sequence === null) return;
	shade(
		sequence.svg,
		spans.flatMap((span) =>
			rowShading(sequence.rows, bounds, span, {
				bottom: options.bottom_strand,
			}),
		),
	);
	outline(sequence.svg, item);
}

/**
 * The row of `rows` holding where `selection` starts, a turn either way, or else the first it
 * lies in; null if none.
 */
function rowOf(
	rows: readonly RowBox[],
	selection: Selection,
	bounds: Bounds,
): RowBox | null {
	const spans =
		"spans" in selection
			? selection.spans
			: [{ start: selection.at - 1, end: selection.at + 1 }];
	const first = "spans" in selection ? spans[0].start : selection.at;
	const shifts = turns(bounds);
	for (const shift of shifts) {
		const row = rowHolding(rows, first + shift);
		if (row) return row;
	}
	const lies = (row: RowBox) =>
		spans.some(({ start, end }) =>
			shifts.some(
				(shift) => row.start < end + shift && start + shift < row.end,
			),
		);
	return rows.find(lies) ?? null;
}

/**
 * Where to scroll a box `sight` long, scrolled to `at`, to show a stretch from `from` and
 * `length` long: where it is if the stretch shows, else with the stretch in the middle.
 */
function inSight(
	at: number,
	sight: number,
	from: number,
	length: number,
): number {
	return from < at || from + length > at + sight
		? from + length / 2 - sight / 2
		: at;
}

/** Put `shapes` in `svg`'s layer of shading, in place of what it held; with none, no layer. */
function shade(svg: SVGSVGElement, shapes: readonly Shape[]): void {
	let layer = layers.get(svg);
	if (!shapes.length) {
		layer?.remove();
		layers.delete(svg);
		return;
	}
	if (!layer) {
		layer = svg.ownerDocument.createElementNS(
			svg.namespaceURI,
			"g",
		) as SVGGElement;
		layer.setAttribute("pointer-events", "none");
		svg.firstElementChild?.after(layer);
		layers.set(svg, layer);
	}
	layer.replaceChildren(...shapeElements(shapes, svg.ownerDocument));
}

/** Outline the shapes of `svg` drawing the item `key`, and no other. */
function outline(svg: SVGSVGElement, key: string | null): void {
	if (outlines.has(svg) && outlines.get(svg) === key) return;
	outlines.set(svg, key);
	for (const shape of svg.querySelectorAll(`[${ITEM}]`)) {
		shape.toggleAttribute(SELECTED, shape.getAttribute(ITEM) === key);
	}
}
