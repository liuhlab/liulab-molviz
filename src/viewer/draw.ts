/** An input drawn live into an element of a page. */

import { prepareGel, preparePlate, prepareViews } from "./drawing";
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
	const { map, sequence } = prepareViews(record, options);
	const drawn = [drawScene(element, map)];
	if (sequence !== null) {
		const view = drawScene(element, sequence);
		// A block, so it starts under the map rather than beside it.
		view.svg.style.display = "block";
		drawn.push(view);
	}
	return {
		destroy: () => {
			for (const one of drawn) one.destroy();
		},
	};
}

/**
 * Draw `gel` into `element`, after what it holds, its letters as real text. Throws one
 * FormatError naming every problem in the gel.
 */
export function drawGel(element: Element, gel: unknown): Drawn {
	return drawScene(element, prepareGel(gel));
}

/**
 * Draw `plate` into `element`, after what it holds, its letters as real text. Throws one
 * FormatError naming every problem in the plate.
 */
export function drawPlate(element: Element, plate: unknown): Drawn {
	return drawScene(element, preparePlate(plate));
}

/** Draw `scene` into `element`, after what it holds, declaring the faces if no drawing has. */
function drawScene(
	element: Element,
	scene: Scene,
): Drawn & { svg: SVGSVGElement } {
	const document = element.ownerDocument;
	declareFaces(document);
	const svg = toElement(scene, document);
	element.append(svg);
	return { svg, destroy: () => svg.remove() };
}

/** Add the faces' `@font-face` rules to `document`, unless a drawing already has. */
function declareFaces(document: Document): void {
	if (document.getElementById(FONTS)) return;
	const style = document.createElement("style");
	style.id = FONTS;
	style.textContent = fontFaceCss();
	document.head.append(style);
}
