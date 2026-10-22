/**
 * A record's frame on a page: a bar of controls, the map's box under it and the sequence view's
 * pane under that. A control changes the frame's state, then calls `redraw`, or `changed` for a
 * change that lays nothing out.
 */

import { aroundBoxes } from "../bounds";
import type { Options } from "../format/options";
import type { Record } from "../format/record";
import type { MapGeometry } from "../map/map";
import {
	GROUND,
	INK,
	LEADER,
	SELECTED_OUTLINE,
	SELECTED_OUTLINE_WIDTH,
} from "../paint";
import type { Box, MapScene, Scene } from "../scene";
import { BOTH_STRANDS, ITEM, SELECTED, TOP_STRAND, toElement } from "../svg";
import { families } from "../text/text";
import { layoutMap } from "../views";
import { hoverBox } from "./hover";
import {
	BESIDE,
	type ClientPoint,
	ONE_STRAND,
	openPane,
	type SequenceShown,
	VIEWS_APART,
} from "./pane";
import type { Selection } from "./selection";

/** The style element holding the frames' rules, shared by every frame on a page. */
const STYLE_ID = "molviz-frame";

type MapName = Options["map"];

/** How far apart, in degrees, the turns are that a turning circle's box is sized from. */
const TURN_STEP = 10;

/** How a frame shows one map. Each map keeps its own, so flipping back finds it as it was. */
export interface MapState {
	/** How many times its opening size the map is laid out. */
	zoom: number;
	/** How far the circle's origin is turned clockwise from the top, in degrees. */
	turn: number;
	/** How far the map's box is scrolled, in CSS pixels, kept while the other map shows. */
	left: number;
	top: number;
}

/** What a frame's controls change. */
export interface FrameState {
	options: Options;
	readonly maps: { readonly [M in MapName]: MapState };
	/** What the reader has selected, drawn in every view; nothing at first. */
	selection: Selection | null;
}

/** A map as a frame shows it: its drawing on the page, and where it sets the bases. */
export interface MapShown {
	readonly svg: SVGSVGElement;
	readonly geometry: MapGeometry;
}

/** A record drawn in a frame on a page, for its controls to change. */
export interface Frame {
	readonly record: Record;
	readonly state: FrameState;
	/** The bar of controls. */
	readonly bar: HTMLFormElement;
	/** The map's box, which keeps its size at 1× and scrolls when the map is zoomed. */
	readonly box: HTMLElement;
	/** The sequence view's pane, no taller than the window, scrolling the view under its bar. */
	readonly pane: HTMLElement;
	/** The pane's bar, stuck at its top: the bottom strand's switch first, then the selection. */
	readonly paneBar: HTMLFormElement;
	/** The state of the map the options name. */
	shown(): MapState;
	/** The box the map shown is laid out over, and how many CSS pixels a point shows as. */
	drawn(): { readonly extent: Scene["extent"]; readonly scale: number };
	/** The map shown: its drawing on the page, and where it sets the bases. */
	map(): MapShown;
	/** The sequence view as shown, or null while it is off or absent. */
	sequence(): SequenceShown | null;
	/** The base of the sequence view at `at`, or with `near` the nearest; null off its strands. */
	sequenceBase(at: ClientPoint, near?: boolean): number | null;
	/**
	 * Show both strands of the sequence view, or the top one alone, as the options say, laying
	 * nothing out again, then call the listeners.
	 */
	showStrands(): void;
	/**
	 * Lay out again what the state changed and swap it in, returning the map. The map flipped
	 * from keeps its scroll, and the one flipped to gets its own back. With `hold`, as a circle
	 * turns, the map keeps one box, and the scale it shows at, sized at the first turn to take in
	 * a full turn; any other redraw lets it go.
	 */
	redraw(hold?: boolean): MapScene;
	/** Lay the map shown out as it opens, at 1× with its origin at the top, its box unscrolled. */
	reset(): void;
	/** Call `listener` after each redraw, and each time `changed` is called. */
	onChange(listener: () => void): void;
	/** Say the state changed in a way that lays nothing out, such as the selection. */
	changed(): void;
	/** Remove the frame, leaving the styles for any other. Calling it again does nothing. */
	destroy(): void;
}

/**
 * The scale a drawing `width` points wide shows at in `room` CSS pixels: shrunk to fit, never
 * enlarged. A room of 0, as before the page is laid out, keeps it at 1.
 */
export function displayScale(width: number, room: number): number {
	return room > 0 ? Math.min(1, room / width) : 1;
}

/** A place in a map's box, in CSS pixels from its top left as it shows. */
export interface Spot {
	readonly x: number;
	readonly y: number;
}

/** The part of a wheel event that moves up or down. */
export type Wheel = Pick<WheelEvent, "deltaY" | "deltaMode">;

/** How far `wheel` moves, in CSS pixels down: a line is 16 of them, a page a box's `height`. */
export function pixels({ deltaY, deltaMode }: Wheel, height: number): number {
	return deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? height : 1);
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
 * `run` before the next paint, once however often the function returned is called before then;
 * at once where nothing paints.
 */
export function beforePaint(view: Window | null, run: () => void): () => void {
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
 * stays over the same place of the map. With `hold`, as the circle turns, the map keeps its box.
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

/** A fieldset of a frame's bar, holding `children`, which the reader knows as `name`. */
export function fieldset(
	document: Document,
	name: string,
	children: readonly (Node | string)[],
	className = "",
): HTMLFieldSetElement {
	const set = document.createElement("fieldset");
	if (className) set.className = className;
	set.setAttribute("aria-label", name);
	set.append(...children);
	return set;
}

/**
 * Draw `record` as `options` say into a frame added at the end of `element`, its bar empty for
 * the controls. With `fit`, the sequence view's rows fit its room rather than holding
 * `options.bases_per_row`, which a print still holds.
 */
export function openFrame(
	element: Element,
	record: Record,
	options: Options,
	fit = false,
): Frame {
	const document = element.ownerDocument;
	declareStyle(document);
	const make = <K extends keyof HTMLElementTagNameMap>(
		tag: K,
		name: string,
	) => {
		const made = document.createElement(tag);
		made.className = name;
		return made;
	};
	const root = make("div", "molviz");
	const bar = make("form", "bar");
	bar.autocomplete = "off";
	const box = make("div", "map");
	root.append(bar, box);
	element.append(root);

	const state: FrameState = {
		options,
		maps: { circle: opening(), line: opening() },
		selection: null,
	};
	const pane = openPane(root, record, () => state.options, fit);
	root.append(pane.element);
	const listeners: (() => void)[] = [];
	const changed = () => {
		for (const listener of listeners) listener();
	};
	/**
	 * Each map's size laid out at 1×, which its box keeps while zoomed, and the options and turn
	 * it was laid out for; none for a turning circle's box.
	 */
	const sizes = new Map<MapName, { extent: Scene["extent"]; for: string }>();
	let shown: {
		name: MapName;
		zoom: number;
		extent: Scene["extent"];
		svg: SVGSVGElement;
		geometry: MapGeometry;
	} | null = null;
	/** The box a turning circle keeps, until a redraw without `hold`. */
	let held: Scene["extent"] | null = null;
	let printing = false;

	/** The scale a map shows at: its size at 1× fitted to its room. */
	const scaleOf = ({ name, extent }: NonNullable<typeof shown>) =>
		displayScale((sizes.get(name)?.extent ?? extent).width, pane.mapRoom());

	/**
	 * Show the sequence view beside the map shown or under it, as the room allows or a page
	 * prints. With `still`, as a circle turns, it stays where it sits. Returns whether it was
	 * drawn anew.
	 */
	const arrangeViews = (still = false): boolean => {
		if (shown === null) return false;
		const map = (sizes.get(shown.name)?.extent ?? shown.extent).width;
		return pane.arrange(map, { still, printing });
	};
	/** Arrange the views again for the room, as the window's size changes. */
	const rearrange = () => {
		if (arrangeViews()) changed();
		sizeToRoom();
	};

	const sizeToRoom = () => {
		if (shown === null) return;
		const { extent } = shown;
		const size = sizes.get(shown.name)?.extent ?? extent;
		const scale = scaleOf(shown);
		const px = (points: number) => (scale === 1 ? "" : `${points * scale}px`);
		shown.svg.style.width = px(extent.width);
		shown.svg.style.height = px(extent.height);
		const zoomed = shown.zoom !== 1;
		box.style.width = zoomed ? `${size.width * scale}px` : "";
		box.style.height = zoomed ? `${size.height * scale}px` : "";
	};

	const redraw = (hold = false) => {
		const name = state.options.map;
		const map = state.maps[name];
		const flipped = shown?.name !== name;
		if (shown !== null && flipped) {
			state.maps[shown.name].left = box.scrollLeft;
			state.maps[shown.name].top = box.scrollTop;
		}
		const laid = layoutMap(record, state.options, map);
		if (!hold || shown === null || flipped) held = null;
		else
			held ??= aroundBoxes([
				shown.extent,
				laid.extent,
				...restOfTurn(record, state.options, map),
			]);
		const scene = held === null ? laid : { ...laid, extent: held };
		const laidFor =
			held === null ? JSON.stringify([state.options, map.turn]) : "";
		if (map.zoom === 1) sizes.set(name, { extent: scene.extent, for: laidFor });
		else if (held === null && sizes.get(name)?.for !== laidFor) {
			const { extent } = layoutMap(record, state.options, { turn: map.turn });
			sizes.set(name, { extent, for: laidFor });
		}
		const svg = toElement(scene, document);
		if (shown === null) box.append(svg);
		else shown.svg.replaceWith(svg);
		hoverBox(svg);
		shown = {
			name,
			zoom: map.zoom,
			extent: scene.extent,
			svg,
			geometry: scene.geometry,
		};
		arrangeViews(held !== null);
		sizeToRoom();
		if (flipped) {
			box.scrollLeft = map.left;
			box.scrollTop = map.top;
		}
		changed();
		return scene;
	};

	// A print shows the sequence view under the map with full rows, and a zoomed map at 1×; after it the
	// map gets its zoom and scroll back.
	let printed: { zoom: number; left: number; top: number } | null = null;
	const beforePrint = () => {
		printing = true;
		const map = state.maps[state.options.map];
		if (map.zoom === 1) return rearrange();
		printed = { zoom: map.zoom, left: box.scrollLeft, top: box.scrollTop };
		map.zoom = 1;
		redraw();
	};
	const afterPrint = () => {
		printing = false;
		if (printed === null) return rearrange();
		const { zoom, left, top } = printed;
		printed = null;
		state.maps[state.options.map].zoom = zoom;
		redraw();
		box.scrollLeft = left;
		box.scrollTop = top;
	};
	const { defaultView } = document;
	defaultView?.addEventListener("resize", rearrange);
	defaultView?.addEventListener("beforeprint", beforePrint);
	defaultView?.addEventListener("afterprint", afterPrint);
	redraw();

	const frame: Frame = {
		record,
		state,
		bar,
		box,
		pane: pane.element,
		paneBar: pane.bar,
		shown: () => state.maps[state.options.map],
		drawn: () => {
			if (shown === null) throw new Error("the frame has drawn no map");
			return { extent: shown.extent, scale: scaleOf(shown) };
		},
		map: () => {
			if (shown === null) throw new Error("the frame has drawn no map");
			return { svg: shown.svg, geometry: shown.geometry };
		},
		sequence: pane.shown,
		sequenceBase: pane.sequenceBase,
		showStrands: () => {
			pane.showStrands();
			changed();
		},
		redraw,
		reset: () => {
			Object.assign(state.maps[state.options.map], opening());
			redraw();
			box.scrollLeft = 0;
			box.scrollTop = 0;
		},
		onChange: (listener) => {
			listeners.push(listener);
		},
		changed,
		destroy: () => {
			defaultView?.removeEventListener("resize", rearrange);
			defaultView?.removeEventListener("beforeprint", beforePrint);
			defaultView?.removeEventListener("afterprint", afterPrint);
			root.remove();
		},
	};
	return frame;
}

/**
 * The boxes of the circle `map` shows laid out turned on from it every `TURN_STEP` degrees, short
 * of a full turn.
 */
function restOfTurn(
	record: Record,
	options: Options,
	{ zoom, turn }: MapState,
): Scene["extent"][] {
	const turns = Array.from(
		{ length: 360 / TURN_STEP - 1 },
		(_, i) => turn + (i + 1) * TURN_STEP,
	);
	return turns.map(
		(one) => layoutMap(record, options, { zoom, turn: one }).extent,
	);
}

/** The state a map opens on: at its size, its origin at the top, unscrolled. */
function opening(): MapState {
	return { zoom: 1, turn: 0, left: 0, top: 0 };
}

/** Add the frames' rules to `document`, unless a frame already has. */
function declareStyle(document: Document): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = css();
	document.head.append(style);
}

/**
 * The frames' rules, each under `.molviz` so a site's own styles leave the bar alone. The enzyme
 * list outranks a docs theme's rules for `<details>`, and takes the browser's own look back.
 */
function css(): string {
	return `
.molviz .bar {
	display: flex; flex-wrap: wrap; align-items: center; gap: 6px 24px;
	margin: 0 0 8px; padding: 8px 0; border-bottom: 1px solid #d9d9d9;
	background: ${GROUND}; color: ${INK};
	font: 13px/1.4 "${families.sans}", sans-serif;
}
.molviz .bar:empty { display: none; }
.molviz .bar fieldset {
	display: flex; flex-wrap: wrap; gap: 4px 14px; min-width: 0;
	margin: 0; padding: 0; border: 0;
}
.molviz .bar label {
	display: inline-flex; align-items: center; gap: 4px; margin: 0; white-space: nowrap;
}
.molviz .bar input { margin: 0; }
.molviz .bar fieldset:disabled { color: ${LEADER}; }
.molviz .bar .enzymes { all: revert; }
.molviz .bar .enzymes > summary { all: revert; cursor: pointer; }
.molviz .bar .enzymes > summary::before, .molviz .bar .enzymes > summary::after {
	content: none;
}
.molviz .bar .enzymes > summary::-webkit-details-marker { display: revert; }
.molviz .bar .enzymes > fieldset { margin: 0; }
.molviz .bar .views { gap: 0; margin-left: auto; }
.molviz .bar .views label {
	position: relative; padding: 2px 10px; border: 1px solid ${LEADER}; cursor: pointer;
}
.molviz .bar .views label + label { border-left: 0; }
.molviz .bar .views label:has([name="sequence"]) {
	margin-left: 10px; border-left: 1px solid ${LEADER};
}
.molviz .bar .views label:has(:checked) { background: ${INK}; color: ${GROUND}; }
.molviz .bar .views label:has(:focus-visible) { outline: 2px solid #0077bb; }
.molviz .bar .views input { position: absolute; opacity: 0; pointer-events: none; }
.molviz .bar .end {
	display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center;
	gap: 6px 24px; margin-left: auto;
}
.molviz .bar .zoom, .molviz .bar .selection { align-items: center; gap: 10px; }
.molviz .bar .selection output { white-space: nowrap; }
.molviz .bar .zoom input { width: 96px; }
.molviz .bar .zoom button, .molviz .bar .selection button {
	padding: 2px 10px; border: 1px solid ${LEADER}; background: ${GROUND};
	color: inherit; font: inherit; cursor: pointer;
}
.molviz.${BESIDE} {
	display: grid; grid-template-columns: max-content max-content; column-gap: ${VIEWS_APART}px;
	align-items: start;
}
.molviz.${BESIDE} > .bar { grid-column: 1 / -1; }
.molviz .map { max-width: 100%; overflow: auto; }
.molviz [hidden] { display: none !important; }
.molviz .sequence { overflow: auto; max-height: 100vh; scrollbar-gutter: stable; }
.molviz .sequence > .bar { position: sticky; top: 0; left: 0; z-index: 1; margin: 0; }
.molviz .sequence:not(.${ONE_STRAND}) .${TOP_STRAND},
.molviz .${ONE_STRAND} .${BOTH_STRANDS} { display: none; }
.molviz svg { display: block; max-width: none; }
.molviz [${ITEM}] { cursor: pointer; }
.molviz path[${SELECTED}], .molviz rect[${SELECTED}], .molviz line[${SELECTED}] {
	stroke: ${SELECTED_OUTLINE}; stroke-width: ${SELECTED_OUTLINE_WIDTH}px;
}
@media print {
	.molviz.${BESIDE} { display: block; }
	.molviz .bar { display: none; }
	.molviz .map, .molviz .sequence {
		overflow: visible; max-height: none; width: auto !important; height: auto !important;
	}
	.molviz svg { max-width: 100%; height: auto !important; }
	.molviz-hover { display: none !important; }
}
`;
}
