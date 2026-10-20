/** A frame's views linked: what the reader selects in either is drawn in both. */

import { aroundBoxes, boxOf } from "./bounds";
import { type Frame, fieldset } from "./frame";
import {
	circleBase,
	circleShading,
	lineBase,
	lineShading,
	type MapGeometry,
	rowBase,
	rowHolding,
	rowShading,
} from "./geometry";
import { hoverBox } from "./hover";
import { turns } from "./pieces";
import { type Bounds, recordBounds, type Span } from "./record";
import type { Shape } from "./scene";
import {
	caption,
	clicked,
	copied,
	type Drag,
	dragFrom,
	dragged,
	dragTo,
	itemSelection,
	type Selection,
	turnTo,
} from "./selection";
import type { RowBox } from "./sequence";
import { shapeElements } from "./svg";

/** The attribute naming the item a shape draws, and the one outlining a selected item's shapes. */
const ITEM = "data-molviz-item";
const SELECTED = "data-molviz-selected";

/** How far, in CSS pixels, a press may move and still be a click. */
const CLICK = 4;

/** Each second, a pointer past the pane's top or foot scrolls it this many times as far. */
const PACE = 20;

/** Each drawing's layer of shading, after its ground and behind everything it draws. */
const layers = new WeakMap<SVGSVGElement, SVGGElement>();

/**
 * For each page, the frame selected in last, whose bases a copy by the keys takes, and whether its
 * Copy button is copying.
 */
const copying = new WeakMap<
	Document,
	{ frame: Frame | null; button: boolean }
>();

/**
 * Select in `frame`'s views: an item by clicking it in either, bases by dragging across the map or
 * across the bases. The selection is said in a caption with Copy, in the pane's bar, or in the
 * frame's bar after Reset while the view does not show.
 */
export function addLinks(frame: Frame): void {
	const { record, state, bar, box, pane, paneBar } = frame;
	const bounds = recordBounds(record);
	const document = pane.ownerDocument;
	const window = document.defaultView;
	const copier = copyKeys(document);
	const select = (selection: Selection | null) => {
		if (JSON.stringify(selection) === JSON.stringify(state.selection)) return;
		state.selection = selection;
		if (selection) copier.frame = frame;
		frame.changed();
	};

	const output = document.createElement("output");
	const copy = document.createElement("button");
	copy.type = "button";
	copy.textContent = "Copy";
	const said = fieldset(document, "Selection", [output, copy], "selection");
	/** Say the selection, in the pane's bar while the view shows, else in the frame's. */
	const say = () => {
		const { selection } = state;
		said.hidden = selection === null;
		output.textContent = selection ? caption(selection, bounds) : "";
		copy.hidden = !(selection && "spans" in selection);
		const home = frame.sequence()
			? paneBar
			: (bar.querySelector(".end") ?? bar);
		if (said.parentElement !== home) home.append(said);
	};
	copy.addEventListener("click", () => {
		const text = state.selection ? copied(state.selection, record.bases) : "";
		if (!text) return;
		copier.frame = frame;
		// Without the clipboard, as on a page not served securely, the copy event takes it.
		const byEvent = () => {
			copier.button = true;
			document.execCommand?.("copy");
			copier.button = false;
		};
		const clipboard = window?.navigator.clipboard;
		if (clipboard) clipboard.writeText(text).catch(byEvent);
		else byEvent();
	});

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
		if (point === null) return null;
		const [x, y] = point;
		return geometry.map === "line"
			? lineBase(geometry, x)
			: circleBase(geometry, x, y);
	};

	/** The base of the sequence view under `event`, or with `near` the nearest; null off it. */
	const viewBase = (
		event: Pick<PointerEvent, "clientX" | "clientY">,
		near = false,
	): number | null => {
		const view = frame.sequence();
		const point = view && inPoints(view.svg, event);
		if (!view || !point) return null;
		const bottom = state.options.bottom_strand;
		return rowBase(view.rows, point[0], point[1], { near, bottom });
	};

	/** What the hover box says over a base of the view: its position. */
	const resolve = (event: PointerEvent) => {
		const base = viewBase(event);
		return base === null ? null : `position ${(base % bounds.length) + 1}`;
	};
	let resolved: SVGSVGElement | null = null;
	const redrawn = () => {
		show(frame, bounds);
		say();
		const view = frame.sequence();
		if (view && view.svg !== resolved) {
			hoverBox(view.svg, resolve);
			resolved = view.svg;
		}
	};
	frame.onChange(redrawn);
	redrawn();

	/** The pane in sight, in client pixels, from its bar's foot to its own; null before layout. */
	const sight = (): { top: number; bottom: number } | null => {
		const { top } = pane.getBoundingClientRect();
		const bottom = top + pane.clientHeight;
		const under = Math.max(top, paneBar.getBoundingClientRect().bottom);
		return bottom > under ? { top: under, bottom } : null;
	};

	/** Where the pointer was last in a drag across bases, and the frame scrolling the pane. */
	let pointer: Pick<PointerEvent, "clientX" | "clientY"> | null = null;
	let gliding = 0;

	/** Take a drag across bases on to the base in sight nearest the pointer. */
	const extend = () => {
		if (!press?.bases || pointer === null) return;
		const seen = sight();
		const clientY = seen
			? Math.min(Math.max(pointer.clientY, seen.top), seen.bottom)
			: pointer.clientY;
		const base = viewBase({ clientX: pointer.clientX, clientY }, true);
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
		const view = frame.sequence();
		const { selection } = state;
		const row = view && selection && rowOf(view.rows, selection, bounds);
		const ctm = view?.svg.getScreenCTM();
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
		const { geometry } = frame.map();
		const boxes = spans
			.flatMap((span) => mapShading(geometry, bounds, span))
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
			const onMap = view === box ? mapBase(event) : null;
			const onBase = view === pane && item === null ? viewBase(event) : null;
			press = {
				x: event.clientX,
				y: event.clientY,
				item,
				map: onMap === null ? null : { base: onMap, drag: null },
				bases: onBase === null ? null : dragFrom(onBase),
			};
			if (press.map || press.bases) svg.setPointerCapture(event.pointerId);
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
				if (!moved(press, event)) return;
				map.drag = dragFrom(map.base);
			}
			const base = mapBase(event);
			if (base === null) return;
			const { geometry } = frame.map();
			map.drag =
				geometry.map === "line"
					? dragTo(map.drag, base)
					: turnTo(map.drag, base, bounds.length);
			select(dragged(map.drag, bounds));
		});
		view.addEventListener("pointerup", (event) => {
			const ended = press;
			press = null;
			stop();
			if (ended === null) return;
			const dragged = ended.bases || ended.map?.drag;
			if (!dragged) {
				if (moved(ended, event)) return;
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
function moved(
	press: { readonly x: number; readonly y: number },
	event: PointerEvent,
): boolean {
	return Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK;
}

/** The point of `svg`'s drawing under `event`, in points; null where it has no place on the page. */
function inPoints(
	svg: SVGSVGElement,
	{ clientX, clientY }: Pick<PointerEvent, "clientX" | "clientY">,
): [number, number] | null {
	const m = svg.getScreenCTM()?.inverse();
	if (!m) return null;
	return [
		m.a * clientX + m.c * clientY + m.e,
		m.b * clientX + m.d * clientY + m.f,
	];
}

/**
 * Let a copy by the keys or the Edit menu on `document` take the bases of the frame selected in
 * last, unless the page has text selected and its Copy button is not copying. Returns whom it
 * asks.
 */
function copyKeys(document: Document): {
	frame: Frame | null;
	button: boolean;
} {
	const kept = copying.get(document);
	if (kept) return kept;
	const copier = { frame: null as Frame | null, button: false };
	copying.set(document, copier);
	document.addEventListener("copy", (event) => {
		const { frame, button } = copier;
		const selection = frame?.box.isConnected ? frame.state.selection : null;
		const text = selection ? copied(selection, frame?.record.bases ?? "") : "";
		if (!text) return;
		if (!button && document.getSelection()?.isCollapsed === false) return;
		event.clipboardData?.setData("text/plain", text);
		event.preventDefault();
	});
	return copier;
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
	shade(
		map.svg,
		spans.flatMap((span) => mapShading(map.geometry, bounds, span)),
	);
	outline(map.svg, item);
	const view = frame.sequence();
	if (view === null) return;
	shade(
		view.svg,
		spans.flatMap((span) =>
			rowShading(view.rows, bounds, span, { bottom: options.bottom_strand }),
		),
	);
	outline(view.svg, item);
}

/** `span` shaded on the map that `geometry` sets the bases of. */
function mapShading(
	geometry: MapGeometry,
	bounds: Bounds,
	span: Span,
): Shape[] {
	return geometry.map === "line"
		? lineShading(geometry, bounds, span)
		: circleShading(geometry, span);
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
	for (const shape of svg.querySelectorAll(`[${ITEM}]`)) {
		shape.toggleAttribute(SELECTED, shape.getAttribute(ITEM) === key);
	}
}
