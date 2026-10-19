/** An input drawn as SVG with real text, for a page that holds no viewer. */

import {
	type Drawing,
	drawn,
	prepare,
	prepareGel,
	preparePlate,
} from "./drawing";
import { toStill } from "./svg";

/**
 * What each call that draws a still SVG returns. Its SVG is laid out as the file's, with each
 * text a `<text>` and each hover a `<title>`; it draws in the viewer's faces only on a page that
 * holds the font rules.
 */
export type Still = Omit<Drawing, "pages">;

/**
 * Draw `record` with `options` as a still SVG. Throws one FormatError naming every problem in
 * the record, or else in the options.
 */
export function stillSvg(record: unknown, options: unknown = {}): Still {
	return drawn(prepare(record, options), toStill);
}

/** Draw `gel` as a still SVG. Throws one FormatError naming every problem in the gel. */
export function gelStillSvg(gel: unknown): Still {
	return drawn(prepareGel(gel), toStill);
}

/** Draw `plate` as a still SVG. Throws one FormatError naming every problem in the plate. */
export function plateStillSvg(plate: unknown): Still {
	return drawn(preparePlate(plate), toStill);
}

// The font rules: the CSS a page writes once, in a `<style>`, for every still SVG it holds.
export { fontFaceCss as fontRules } from "./text";
