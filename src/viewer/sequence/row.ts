/**
 * A row of the sequence view: the cell each base takes, where the row and its strands lie, and
 * the tiers of what runs on into the next row.
 */

import type { Box } from "../scene";

/** How wide a base's cell is. */
export const CELL = 11;

/** The box a row takes, the bases it holds, counted as the span counts, and its strands. */
export interface RowBox extends Box {
	readonly start: number;
	readonly end: number;
	readonly strands: Strands;
}

/** Where a row's strands lie, each from its top to its bottom, and its rail between them. */
export interface Strands {
	readonly top: readonly [top: number, bottom: number];
	readonly rail: number;
	/** Nothing when the bottom strand is not drawn. */
	readonly bottom: readonly [top: number, bottom: number] | null;
}

/**
 * The tier each item running on from one row into the next took, by the item: a bar by its
 * label, a primer site or a read by itself.
 */
export type RunOn = Map<object, number>;
