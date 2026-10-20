/** Where a record's sequence view sits against its map, from the room they have. */

/** Widths in CSS pixels: the map at 1×, and the sequence view laid out with full or half rows. */
export interface Widths {
	readonly map: number;
	readonly full: number;
	readonly half: number;
}

/** Where the sequence view sits, which rows it is laid out with, and the scale it shows at. */
export interface Arrangement {
	readonly place: "beside" | "under";
	readonly rows: "full" | "half";
	readonly scale: number;
}

/**
 * The arrangement in `room` CSS pixels, with `gap` between a map and a view beside it: beside
 * only when both fit at full size, else under, scaled down only with half rows. A room of 0, as
 * before the page is laid out, keeps the view under with full rows at 1.
 */
export function arrange(
	room: number,
	gap: number,
	widths: Widths,
): Arrangement {
	const { map, full, half } = widths;
	if (room <= 0) return { place: "under", rows: "full", scale: 1 };
	if (map + gap + full <= room)
		return { place: "beside", rows: "full", scale: 1 };
	if (map + gap + half <= room)
		return { place: "beside", rows: "half", scale: 1 };
	if (full <= room) return { place: "under", rows: "full", scale: 1 };
	return { place: "under", rows: "half", scale: Math.min(1, room / half) };
}
