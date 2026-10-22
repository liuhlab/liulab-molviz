/** An input drawn live into an element of a page. */

import { addCaption } from "./caption";
import type { Layout } from "./drawing";
import { type Frame, openFrame } from "./frame";
import { addLinks } from "./link";
import { checkOptions, type Options } from "./options";
import { check, type Record } from "./record";
import { toElement } from "./svg";
import { switches } from "./switches";
import { fontFaceCss } from "./text";
import { addTurn } from "./turn";
import { addZoom } from "./zoom";

/** The style element declaring the viewer's faces, shared by every drawing on a page. */
const FONTS = "molviz-fonts";

/** A drawing in an element of a page. */
export interface LiveDrawing {
	/** Remove the drawing, leaving the faces for any other. Calling it again does nothing. */
	destroy(): void;
}

/**
 * Draw `record` with `options` into `element`, after what it holds, its letters as real text: a
 * bar of controls, the map, and the sequence view under it. A span past the sequence view's limit
 * leaves the view out. Throws one FormatError naming every problem in the record, or else in the
 * options.
 */
export function drawRecord(
	element: Element,
	record: unknown,
	options: unknown = {},
): LiveDrawing {
	const checked = check(record);
	const checkedOptions = checkOptions(options, checked, { page: true });
	declareFaces(element.ownerDocument);
	return { destroy: openRecord(element, checked, checkedOptions).destroy };
}

/**
 * Open `record` with `options` in a frame added at the end of `element`, with its controls: the
 * switches, the zoom and the turn, its views linked, and the caption of their selection.
 */
export function openRecord(
	element: Element,
	record: Record,
	options: Options,
): Frame {
	const frame = openFrame(element, record, options);
	switches(frame);
	addZoom(frame);
	addTurn(frame);
	addLinks(frame);
	addCaption(frame);
	return frame;
}

/**
 * Draw `layout` into `element`, after what it holds, as its still drawing draws, declaring the
 * faces if no drawing has.
 */
export function drawLayout(element: Element, layout: Layout): LiveDrawing {
	const document = element.ownerDocument;
	declareFaces(document);
	const svg = toElement(layout.scene, document, { tips: false });
	element.append(svg);
	return { destroy: () => svg.remove() };
}

/** Add the font rules to `document` once, for every drawing on it, live or still. */
export function declareFaces(document: Document): void {
	if (document.getElementById(FONTS)) return;
	const style = document.createElement("style");
	style.id = FONTS;
	style.textContent = fontFaceCss();
	document.head.append(style);
}
