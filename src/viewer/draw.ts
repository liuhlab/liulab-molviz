/** A record or a gel drawn live into an element of a page. */

import { prepare, prepareGel } from "./drawing";
import type { Scene } from "./scene";
import { toElement } from "./svg";
import { fontFaceCss } from "./text";

/** The style element declaring the viewer's faces, shared by every drawing on a page. */
const FONTS = "molviz-fonts";

/** A drawing in an element of a page. */
export interface Drawn {
	/** Remove the drawing, leaving the faces for any other. Calling it again does nothing. */
	destroy(): void;
}

/**
 * Draw `record` with `options` into `element`, after what it holds, its letters as real text.
 * Throws one FormatError naming every problem in the record, or else in the options.
 */
export function draw(
	element: Element,
	record: unknown,
	options: unknown = {},
): Drawn {
	return drawScene(element, prepare(record, options));
}

/**
 * Draw `gel` into `element`, after what it holds, its letters as real text. Throws one
 * FormatError naming every problem in the gel.
 */
export function drawGel(element: Element, gel: unknown): Drawn {
	return drawScene(element, prepareGel(gel));
}

/** Draw `scene` into `element`, after what it holds, declaring the faces if no drawing has. */
function drawScene(element: Element, scene: Scene): Drawn {
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
