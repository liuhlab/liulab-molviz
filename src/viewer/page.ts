/**
 * A record on a page: a bar of controls, the map's box under it and the sequence view's under
 * that. A control changes the page's state, then calls `redraw`.
 */

import { aroundBoxes } from "./bounds";
import { layoutMap } from "./drawing";
import { hoverBox } from "./hover";
import type { MapScene } from "./labels";
import { LIMIT, type Options } from "./options";
import type { Record } from "./record";
import type { Scene } from "./scene";
import { layoutSequence } from "./sequence";
import { toElement } from "./svg";
import { families } from "./text";
import { addTurn } from "./turn";
import { addZoom } from "./zoom";

/** The style element holding the pages' rules, shared by every page on a document. */
const STYLE = "molviz-page";

type MapName = Options["map"];

/** How a page shows one map. Each map keeps its own, so flipping back finds it as it was. */
export interface MapState {
	/** How many times its opening size the map is laid out. */
	zoom: number;
	/** How far the circle's origin is turned clockwise from the top, in degrees. */
	turn: number;
	/** How far the map's box is scrolled, in CSS pixels, kept while the other map shows. */
	left: number;
	top: number;
}

/** What a page's controls change. */
export interface PageState {
	options: Options;
	readonly maps: { readonly [M in MapName]: MapState };
}

/** A record drawn on a page, for its controls to change. */
export interface Page {
	readonly record: Record;
	readonly state: PageState;
	/** The bar of controls. The map's flip and the sequence view's switch sit at its right. */
	readonly bar: HTMLFormElement;
	/** The map's box, which keeps its size at 1× and scrolls when the map is zoomed. */
	readonly box: HTMLElement;
	/** The state of the map the options name. */
	shown(): MapState;
	/** The box the map shown is laid out over, and how many CSS pixels a point shows as. */
	drawn(): { readonly extent: Scene["extent"]; readonly scale: number };
	/**
	 * Lay out again what the state changed and swap it in, returning the map. The map flipped
	 * from keeps its scroll, and the one flipped to gets its own back. With `hold`, the map's box
	 * takes in the one shown, so a circle turning stays in place.
	 */
	redraw(hold?: boolean): MapScene;
	/** Remove the page, leaving the styles for any other. Calling it again does nothing. */
	destroy(): void;
}

/**
 * The scale a drawing `width` points wide shows at in `room` CSS pixels: shrunk to fit, never
 * enlarged. A room of 0, as before the page is laid out, keeps it at 1.
 */
export function displayScale(width: number, room: number): number {
	return room > 0 ? Math.min(1, room / width) : 1;
}

/** Draw `record` as `options` say into a page added at the end of `element`. */
export function openPage(
	element: Element,
	record: Record,
	options: Options,
): Page {
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
	const frame = make("div", "molviz");
	const bar = make("form", "bar");
	bar.autocomplete = "off";
	const box = make("div", "map");
	const pane = make("div", "sequence");
	frame.append(bar, box, pane);
	element.append(frame);

	const state: PageState = {
		options,
		maps: { circle: opening(), line: opening() },
	};
	/** Each map's size when last laid out at 1×, which its box keeps while zoomed. */
	const sizes = new Map<MapName, Scene["extent"]>();
	let shown: {
		name: MapName;
		zoom: number;
		extent: Scene["extent"];
		svg: SVGSVGElement;
	} | null = null;
	let sequenceDrawn: string | null = null;

	/** The scale a map shows at: its size at 1× fitted to the room. */
	const scaleOf = ({ name, extent }: NonNullable<typeof shown>) =>
		displayScale((sizes.get(name) ?? extent).width, frame.clientWidth);

	const fit = () => {
		if (shown === null) return;
		const { extent } = shown;
		const size = sizes.get(shown.name) ?? extent;
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
		const scene =
			hold && shown !== null && !flipped
				? { ...laid, extent: aroundBoxes([shown.extent, laid.extent]) }
				: laid;
		if (map.zoom === 1) sizes.set(name, scene.extent);
		const svg = toElement(scene, document);
		hoverBox(svg);
		if (shown === null) box.append(svg);
		else shown.svg.replaceWith(svg);
		shown = { name, zoom: map.zoom, extent: scene.extent, svg };
		fit();
		if (flipped) {
			box.scrollLeft = map.left;
			box.scrollTop = map.top;
		}
		sequenceDrawn = redrawSequence(record, state.options, pane, sequenceDrawn);
		return scene;
	};

	const views = viewSwitches(record, options, document);
	if (views !== null) {
		bar.append(views);
		views.addEventListener("change", (event) => {
			const { name, value, checked } = event.target as HTMLInputElement;
			state.options =
				name === "map"
					? { ...state.options, map: value as MapName }
					: { ...state.options, sequence_view: checked };
			redraw();
		});
	}
	const { defaultView } = document;
	defaultView?.addEventListener("resize", fit);
	redraw();

	const page: Page = {
		record,
		state,
		bar,
		box,
		shown: () => state.maps[state.options.map],
		drawn: () => {
			if (shown === null) throw new Error("the page has drawn no map");
			return { extent: shown.extent, scale: scaleOf(shown) };
		},
		redraw,
		destroy: () => {
			defaultView?.removeEventListener("resize", fit);
			frame.remove();
		},
	};
	addZoom(page);
	addTurn(page);
	return page;
}

/** The state a map opens on: at its size, its origin at the top, unscrolled. */
function opening(): MapState {
	return { zoom: 1, turn: 0, left: 0, top: 0 };
}

/**
 * Show or hide the sequence view in `pane` as `options` say, laying it out again only if the
 * options it reads changed since it was `drawn`. Returns what it is drawn for now.
 */
function redrawSequence(
	record: Record,
	options: Options,
	pane: HTMLElement,
	drawn: string | null,
): string | null {
	pane.hidden = !options.sequence_view;
	if (!options.sequence_view) return drawn;
	const reads = JSON.stringify({ ...options, map: null, sequence_view: null });
	if (reads === drawn) return drawn;
	const svg = toElement(layoutSequence(record, options), pane.ownerDocument);
	pane.replaceChildren(svg);
	return reads;
}

/**
 * The flip between Circle and Line, for a whole circular record, and the sequence view's switch,
 * for a span the view can draw; null if neither.
 */
function viewSwitches(
	record: Record,
	{ span, map, sequence_view }: Options,
	document: Document,
): HTMLFieldSetElement | null {
	const labels: HTMLLabelElement[] = [];
	if (record.circular && span.start === 0 && span.end === record.bases.length) {
		for (const name of ["circle", "line"] as const) {
			labels.push(choice(document, "radio", "map", name, map === name));
		}
	}
	if (span.end - span.start <= LIMIT) {
		labels.push(
			choice(document, "checkbox", "sequence", "sequence", sequence_view),
		);
	}
	if (labels.length === 0) return null;
	const set = document.createElement("fieldset");
	set.className = "views";
	set.setAttribute("aria-label", "Views");
	set.append(...labels);
	return set;
}

/** A labelled input named `name` holding `value`, which its label says capitalised. */
function choice(
	document: Document,
	type: "radio" | "checkbox",
	name: string,
	value: string,
	checked: boolean,
): HTMLLabelElement {
	const input = document.createElement("input");
	input.type = type;
	input.name = name;
	input.value = value;
	input.checked = checked;
	const label = document.createElement("label");
	label.append(input, value[0].toUpperCase() + value.slice(1));
	return label;
}

/** Add the pages' rules to `document`, unless a page already has. */
function declareStyle(document: Document): void {
	if (document.getElementById(STYLE)) return;
	const style = document.createElement("style");
	style.id = STYLE;
	style.textContent = css();
	document.head.append(style);
}

/** The pages' rules, each under `.molviz` so a site's own styles leave the bar alone. */
function css(): string {
	return `
.molviz .bar {
	display: flex; flex-wrap: wrap; align-items: center; gap: 6px 24px;
	margin: 0 0 8px; padding: 8px 0; border-bottom: 1px solid #d9d9d9;
	background: #ffffff; color: #252525;
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
.molviz .bar fieldset:disabled { color: #7f7f7f; }
.molviz .bar summary { cursor: pointer; }
.molviz .bar .views { gap: 0; margin-left: auto; }
.molviz .bar .views label {
	position: relative; padding: 2px 10px; border: 1px solid #7f7f7f; cursor: pointer;
}
.molviz .bar .views label + label { border-left: 0; }
.molviz .bar .views label:has([name="sequence"]) {
	margin-left: 10px; border-left: 1px solid #7f7f7f;
}
.molviz .bar .views label:has(:checked) { background: #252525; color: #ffffff; }
.molviz .bar .views label:has(:focus-visible) { outline: 2px solid #0077bb; }
.molviz .bar .views input { position: absolute; opacity: 0; pointer-events: none; }
.molviz .bar .zoom { align-items: center; gap: 10px; margin-left: auto; }
.molviz .bar .views ~ .zoom { margin-left: 0; }
.molviz .bar .zoom input { width: 96px; }
.molviz .bar .zoom button {
	padding: 2px 10px; border: 1px solid #7f7f7f; background: #ffffff;
	color: inherit; font: inherit; cursor: pointer;
}
.molviz .map { max-width: 100%; overflow: auto; }
.molviz .sequence { overflow-x: auto; }
.molviz svg { display: block; max-width: none; }
`;
}
