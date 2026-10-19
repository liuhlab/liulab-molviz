/** A record's cuts, counted per enzyme over the whole record. */

import type { Record } from "./record";

/** How many times each enzyme cuts `record`, in the order the cuts first name them. */
export function cutCounts(record: Record): Map<string, number> {
	const counts = new Map<string, number>();
	for (const { enzyme } of record.cuts) {
		counts.set(enzyme, (counts.get(enzyme) ?? 0) + 1);
	}
	return counts;
}

/** The enzymes that cut `record` once, in the order the cuts first name them. */
export function uniqueCutters(record: Record): string[] {
	return [...cutCounts(record)].flatMap(([enzyme, n]) =>
		n === 1 ? [enzyme] : [],
	);
}
