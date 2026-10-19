/** An input drawn as SVG with real text, for a page that holds no viewer. */

import { prepare, prepareGel, preparePlate } from "./drawing";
import { type Hidden, notice } from "./labels";
import { toStill } from "./svg";
import { fontFaceCss } from "./text";

/** What each call that draws a still SVG returns. */
export interface Still {
	/**
	 * The whole drawing, laid out as the file's SVG is, its letters `<text>` and each hover a
	 * `<title>`. It draws in the viewer's faces only on a page that holds the font rules.
	 */
	readonly svg: string;
	/** The labels left out because they would overlap, each counted in the notice. */
	readonly hidden: readonly Hidden[];
	/** The hidden-label notice as a sentence, empty when nothing hides. */
	readonly notice: string;
}

/**
 * Draw `record` with `options` as a still SVG. Throws one FormatError naming every problem in
 * the record, or else in the options.
 */
export function stillSvg(record: unknown, options: unknown = {}): Still {
	const scene = prepare(record, options);
	return still(toStill(scene), scene.hidden);
}

/** Draw `gel` as a still SVG. Throws one FormatError naming every problem in the gel. */
export function gelStillSvg(gel: unknown): Still {
	return still(toStill(prepareGel(gel)));
}

/** Draw `plate` as a still SVG. Throws one FormatError naming every problem in the plate. */
export function plateStillSvg(plate: unknown): Still {
	return still(toStill(preparePlate(plate)));
}

/**
 * The CSS a page writes once, in a `<style>`, for every still SVG it holds: an `@font-face`
 * rule for each of the viewer's faces, each loading its face from a data URL.
 */
export function fontRules(): string {
	return fontFaceCss();
}

function still(svg: string, hidden: readonly Hidden[] = []): Still {
	return { svg, hidden, notice: notice(hidden) };
}
