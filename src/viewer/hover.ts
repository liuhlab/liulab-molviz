/** The hover box: a drawing's hovers shown at once beside the pointer, in place of `<title>`. */

import { GROUND, INK, LEADER } from "./paint";
import { families } from "./text";

/** The attribute that holds, on a shape, what the box shows over it. */
const HOVER = "data-molviz-hover";

/** How far the box keeps from the pointer. */
const OFFSET = 14;

const BOX_CSS = [
	"position:fixed",
	"z-index:10",
	"pointer-events:none",
	"max-width:320px",
	"padding:5px 8px",
	`border:1px solid ${LEADER}`,
	"border-radius:3px",
	`background:${GROUND}`,
	"box-shadow:0 1px 4px rgb(0 0 0 / 20%)",
	`color:${INK}`,
	`font:12px/1.4 "${families.sans}", sans-serif`,
].join(";");

/** What the box says for a pointer over a drawing but none of its hovers; null for nothing. */
export type Resolver = (event: PointerEvent) => string | null;

/** What the box shows: the shape, or the drawing, it shows it for, and what it says. */
interface Shows {
	over: Element | null;
	text: string | null;
}

/** For each document whose pointer the box follows, what the box shows. */
const followed = new WeakMap<Document, Shows>();

/** Each drawing's resolver, for a drawing given one. */
const resolvers = new WeakMap<Element, Resolver>();

/** One box a page shows, for each of its drawings. */
const boxes = new WeakMap<Document, HTMLElement>();

/**
 * Show the hovers of `svg`, just put on a page, in a box the moment the pointer rests on one, in
 * place of each `<title>`: its first line in bold, then the rest, `OFFSET` off the pointer and
 * flipped at the window's edge. Over the drawing but none of its hovers, the box says what
 * `resolve` returns, in one plain line, or hides for null. A box showing a shape no longer on the
 * page hides.
 */
export function hoverBox(svg: SVGSVGElement, resolve?: Resolver): void {
	for (const title of [...svg.querySelectorAll("title")]) {
		title.parentElement?.setAttribute(HOVER, title.textContent ?? "");
		title.remove();
	}
	if (resolve) resolvers.set(svg, resolve);
	const document = svg.ownerDocument;
	const { over } = follow(document);
	if (over !== null && !over.isConnected) hide(document);
}

/**
 * Where the box's top left corner goes for a pointer at `pointer`: `OFFSET` right of and below
 * it, or left of or above it where the box would pass the edge of a window `room` big, but never
 * past the window's top or left.
 */
export function boxPlace(
	pointer: { readonly x: number; readonly y: number },
	box: { readonly width: number; readonly height: number },
	room: { readonly width: number; readonly height: number },
): { left: number; top: number } {
	const along = (at: number, size: number, edge: number) =>
		Math.max(0, at + OFFSET + size > edge ? at - OFFSET - size : at + OFFSET);
	return {
		left: along(pointer.x, box.width, room.width),
		top: along(pointer.y, box.height, room.height),
	};
}

/**
 * Show the box over each hover the pointer rests on in `document`, once a drawing asks. Returns
 * what the box shows.
 */
function follow(document: Document): Shows {
	const kept = followed.get(document);
	if (kept) return kept;
	const shows: Shows = { over: null, text: null };
	followed.set(document, shows);
	document.addEventListener("pointermove", (event) => {
		const now = showing(event);
		if (now === null) {
			hide(document);
			return;
		}
		const box = boxIn(document);
		if (now.over !== shows.over || now.text !== shows.text) {
			say(box, now.text, now.plain);
			shows.over = now.over;
			shows.text = now.text;
		}
		box.hidden = false;
		const window = document.defaultView;
		const { left, top } = boxPlace(
			{ x: event.clientX, y: event.clientY },
			{ width: box.offsetWidth, height: box.offsetHeight },
			{ width: window?.innerWidth ?? 0, height: window?.innerHeight ?? 0 },
		);
		box.style.left = `${left}px`;
		box.style.top = `${top}px`;
	});
	document.addEventListener("pointerout", (event) => {
		if (event.relatedTarget === null) hide(document);
	});
	return shows;
}

/**
 * What the box shows for the pointer at `event`: the hover of the shape under it, else what the
 * resolver of the drawing under it says, plain; null for nothing.
 */
function showing(
	event: PointerEvent,
): { over: Element; text: string; plain: boolean } | null {
	const target = event.target as Partial<Element> | null;
	const over = target?.closest?.(`[${HOVER}]`) ?? null;
	if (over !== null) {
		return { over, text: over.getAttribute(HOVER) ?? "", plain: false };
	}
	const drawing = target?.closest?.("svg");
	const text = drawing ? (resolvers.get(drawing)?.(event) ?? null) : null;
	if (!drawing || text === null) return null;
	return { over: drawing, text, plain: true };
}

/** Hide `document`'s box, showing nothing. */
function hide(document: Document): void {
	boxes.get(document)?.setAttribute("hidden", "");
	const shows = followed.get(document);
	if (shows) {
		shows.over = null;
		shows.text = null;
	}
}

/** The page's box, added to `document` hidden if it has none. */
function boxIn(document: Document): HTMLElement {
	const kept = boxes.get(document);
	if (kept?.isConnected) return kept;
	const box = document.createElement("div");
	box.className = "molviz-hover";
	box.style.cssText = BOX_CSS;
	box.hidden = true;
	document.body.append(box);
	boxes.set(document, box);
	return box;
}

/**
 * Fill `box` with `hover`, a line each, its first in bold unless it is blank; if `plain`, as one
 * plain line.
 */
function say(box: HTMLElement, hover: string, plain: boolean): void {
	if (plain) {
		box.replaceChildren(line(box, hover, false));
		return;
	}
	const [first, ...rest] = hover.split("\n");
	const lines = rest.map((text) => line(box, text, false));
	if (first.trim()) lines.unshift(line(box, first, true));
	box.replaceChildren(...lines);
}

function line(box: HTMLElement, text: string, bold: boolean): HTMLElement {
	const one = box.ownerDocument.createElement("div");
	one.textContent = text;
	if (bold) one.style.fontWeight = "700";
	return one;
}
