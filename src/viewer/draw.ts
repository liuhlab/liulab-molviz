/** An input drawn live into an element of a page. */

import { prepareGel, preparePlate } from "./drawing";
import { checkOptions } from "./options";
import { openPage } from "./page";
import { check } from "./record";
import type { Scene } from "./scene";
import { toElement } from "./svg";
import { switches } from "./switches";
import { fontFaceCss } from "./text";

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
export function draw(
	element: Element,
	record: unknown,
	options: unknown = {},
): LiveDrawing {
	const checked = check(record);
	const drawn = checkOptions(options, checked, { page: true });
	declareFaces(element.ownerDocument);
	const page = openPage(element, checked, drawn);
	switches(page);
	return { destroy: page.destroy };
}

/**
 * Draw `gel` into `element`, after what it holds, its letters as real text. Throws one
 * FormatError naming every problem in the gel.
 */
export function drawGel(element: Element, gel: unknown): LiveDrawing {
	return drawScene(element, prepareGel(gel));
}

/**
 * Draw `plate` into `element`, after what it holds, its letters as real text. Throws one
 * FormatError naming every problem in the plate.
 */
export function drawPlate(element: Element, plate: unknown): LiveDrawing {
	return drawScene(element, preparePlate(plate));
}

/** Draw `scene` into `element`, after what it holds, declaring the faces if no drawing has. */
function drawScene(element: Element, scene: Scene): LiveDrawing {
	const document = element.ownerDocument;
	declareFaces(document);
	const svg = toElement(scene, document);
	element.append(svg);
	return { destroy: () => svg.remove() };
}

/** Add the faces' `@font-face` rules to `document`, unless a drawing already has. */
function declareFaces(document: Document): void {
	if (document.getElementById(FONTS)) return;
	const style = document.createElement("style");
	style.id = FONTS;
	style.textContent = fontFaceCss();
	document.head.append(style);
}
