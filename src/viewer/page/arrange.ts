/**
 * Where a record's sequence view sits against its map, and how many bases its rows hold, from the
 * room they have.
 */

import { CELL } from "../sequence/row";

/** The fewest and most bases a row fitted to the room holds, and the step between its lengths. */
const FEWEST = 20;
const MOST = 100;
const STEP = 10;

/** The bases a row holds in a file, and the fewest a fitted row beside the map holds. */
const USUAL = 60;

/** Widths in CSS pixels: the map at 1×, and the sequence view with rows of `perRow` bases. */
export interface Widths {
	readonly map: number;
	/** Never narrower than its row's cells. */
	view(perRow: number): number;
}

/** Where the sequence view sits, how many bases a row holds, and the scale it shows at. */
export interface Arrangement {
	readonly place: "beside" | "under";
	readonly perRow: number;
	readonly scale: number;
}

/**
 * The arrangement in `room` CSS pixels, with `gap` between a map and a view beside it, for rows
 * of `given` bases or else fitted to the room. The view sits beside the map once a row of 60, or
 * of `given`, fits there, else under it. A fitted row holds the most bases that fit its room, in
 * steps of 10 from 20 to 100. A room too narrow for a row of 20, or of `given`, scales the view
 * down. A room of 0, as before the page is laid out, keeps the view under at full size, with
 * rows of 60 or `given`.
 */
export function arrange(
	room: number,
	gap: number,
	{ map, view }: Widths,
	given?: number,
): Arrangement {
	if (room <= 0) return { place: "under", perRow: given ?? USUAL, scale: 1 };
	/** Whether the view with rows of `perRow` bases fits the room after `taken` pixels. */
	const fits = (taken: number) => (perRow: number) =>
		// A row too long for its cells alone is never laid out.
		taken + perRow * CELL <= room && taken + view(perRow) <= room;
	const beside = fits(map + gap);
	if (beside(given ?? USUAL)) {
		const perRow = given ?? most(USUAL, beside) ?? USUAL;
		return { place: "beside", perRow, scale: 1 };
	}
	const perRow = given ?? most(FEWEST, fits(0)) ?? FEWEST;
	return {
		place: "under",
		perRow,
		scale: Math.min(1, room / view(perRow)),
	};
}

/** The most bases a row holds, from 100 down to `fewest` in steps, such that it `fits`, if any. */
function most(
	fewest: number,
	fits: (perRow: number) => boolean,
): number | undefined {
	for (let perRow = MOST; perRow >= fewest; perRow -= STEP) {
		if (fits(perRow)) return perRow;
	}
	return undefined;
}
