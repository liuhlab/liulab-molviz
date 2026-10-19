/** The hover box: a drawing's hovers shown at once beside the pointer, in place of `<title>`. */

import { INK } from "./paint";
import { families } from "./text";

/** The attribute that holds, on a shape, what the box shows over it. */
const HOVER = "data-molviz-hover";

/** How far the box keeps from the pointer. */
const OFFSET = 14;

const STYLE = [
	"position:fixed",
	"z-index:10",
	"pointer-events:none",
	"max-width:320px",
	"padding:5px 8px",
	"border:1px solid #7f7f7f",
	"border-radius:3px",
	"background:#ffffff",
	"box-shadow:0 1px 4px rgb(0 0 0 / 20%)",
	`color:${INK}`,
	`font:12px/1.4 "${families.sans}", sans-serif`,
].join(";");

/** The documents whose pointer the box follows. */
const followed = new WeakSet<Document>();

/** One box a page shows, for each of its drawings. */
const boxes = new WeakMap<Document, HTMLElement>();

/**
 * Show the hovers of `svg`, drawn on a page, in a box the moment the pointer rests on one, in
 * place of each `<title>`: its first line in bold, then the rest, `OFFSET` off the pointer and
 * flipped at the window's edge.
 */
export function hoverBox(svg: SVGSVGElement): void {
	for (const title of [...svg.querySelectorAll("title")]) {
		title.parentElement?.setAttribute(HOVER, title.textContent ?? "");
		title.remove();
	}
	follow(svg.ownerDocument);
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

/** Show the box over each hover the pointer rests on in `document`, once a drawing asks. */
function follow(document: Document): void {
	if (followed.has(document)) return;
	followed.add(document);
	let shown: Element | null = null;
	const hide = () => {
		boxes.get(document)?.setAttribute("hidden", "");
		shown = null;
	};
	document.addEventListener("pointermove", (event) => {
		const target = event.target as Partial<Element> | null;
		const over = target?.closest?.(`[${HOVER}]`) ?? null;
		if (over === null) {
			hide();
			return;
		}
		const box = boxIn(document);
		if (over !== shown) {
			say(box, over.getAttribute(HOVER) ?? "");
			shown = over;
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
		if (event.relatedTarget === null) hide();
	});
}

/** The page's box, added to `document` hidden if it has none. */
function boxIn(document: Document): HTMLElement {
	const kept = boxes.get(document);
	if (kept?.isConnected) return kept;
	const box = document.createElement("div");
	box.style.cssText = STYLE;
	box.hidden = true;
	document.body.append(box);
	boxes.set(document, box);
	return box;
}

/** Fill `box` with `hover`, a line each, its first in bold unless it is blank. */
function say(box: HTMLElement, hover: string): void {
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
