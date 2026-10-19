/** The sequence view's primers, cut sites and insertions, each row's lanes and marks of them. */

import type { Drawn, Lane, Row, Strands } from "./sequence";

/** The forward primers' arrows in `row`, in a lane from `top` down, above its numbers. */
export function forwardPrimers(_row: Row, top: number): Lane {
	return { shapes: [], labels: [], bottom: top };
}

/** The reverse primers' arrows in `row`, in a lane from `top` down, under its strands. */
export function reversePrimers(_row: Row, top: number): Lane {
	return { shapes: [], labels: [], bottom: top };
}

/** The cut sites and insertions in `row`, drawn through its `strands`. */
export function acrossStrands(_row: Row, _strands: Strands): Drawn {
	return { shapes: [], labels: [] };
}
