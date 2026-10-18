/** What the gel and plate drawings share: their margin, least width, title and ink, and lines. */

import type { Shape } from "./scene";
import { baseline, type Face } from "./text";

export const MARGIN = 10;
/** The least width a drawing takes, so a narrow one still has room for its title and legend. */
export const MIN_WIDTH = 240;

export const TITLE_SIZE = 13;
/** The room between the title and what is under it. */
export const TITLE_GAP = 6;
/** A line of text's height, per unit of its size. */
export const LEADING = 1.3;
export const INK = "#1c1e21";

/** How `lines` sets its text: where `x` is on each line, its colour, and its leading. */
interface Setting {
	readonly anchor?: "start" | "middle";
	readonly fill?: string;
	readonly leading?: number;
}

/**
 * Add `wrapped` to `shapes`, one line under another from `top` at `x`, each `leading` times
 * `size` tall with its text centred in it. Returns where they end.
 */
export function lines(
	shapes: Shape[],
	wrapped: readonly string[],
	face: Face,
	size: number,
	x: number,
	top: number,
	{ anchor = "start", fill = INK, leading = LEADING }: Setting = {},
): number {
	for (const [i, line] of wrapped.entries()) {
		const lineTop = top + i * leading * size;
		const y = baseline(face, size, lineTop + (leading * size) / 2);
		shapes.push({ shape: "text", text: line, face, size, x, y, anchor, fill });
	}
	return top + wrapped.length * leading * size;
}
