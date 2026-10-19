/** A record's cuts: counted per enzyme over the whole record, and merged into cut sites. */

import { folded } from "./format";
import { type Label, labelOf, type Run } from "./labels";
import { ENZYME } from "./paint";
import type { Record } from "./record";
import type { Face } from "./text";

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

/** A cut site, and the label a map gives it. */
export interface CutSite {
	/** Where its enzymes cut the top strand, as the record counts. */
	readonly at: number;
	readonly label: Label;
}

const SEPARATOR = " - ";

/**
 * The cut sites of the enzymes `enzymes` names, whatever their case, in order of position. A
 * site is dimmed when `highlight` names something, but none of its enzymes.
 */
export function cutSites(
	record: Record,
	enzymes: readonly string[],
	highlight: readonly string[] = [],
): CutSite[] {
	const on = new Set(enzymes.map(folded));
	const named = new Map<number, Set<string>>();
	for (const { enzyme, at } of record.cuts) {
		if (on.has(folded(enzyme))) {
			named.set(at, (named.get(at) ?? new Set()).add(enzyme));
		}
	}
	const counts = cutCounts(record);
	return [...named]
		.sort(([a], [b]) => a - b)
		.map(([at, names]) => ({
			at,
			label: siteLabel(record, at, [...names].sort(byName), counts, highlight),
		}));
}

/**
 * The label of the cut site at `at`: its `enzymes` joined, then the base after the cut, as
 * `BanII - SacI (406)`. The name of an enzyme that cuts the record once is bold.
 */
function siteLabel(
	record: Record,
	at: number,
	enzymes: readonly string[],
	counts: ReadonlyMap<string, number>,
	highlight: readonly string[],
): Label {
	const runs: Run[] = [];
	const add = (text: string, face: Face) => {
		const last = runs.at(-1);
		if (last?.face === face)
			runs[runs.length - 1] = { face, text: last.text + text };
		else runs.push({ text, face });
	};
	for (const [i, enzyme] of enzymes.entries()) {
		if (i) add(SEPARATOR, "sans");
		add(enzyme, counts.get(enzyme) === 1 ? "sans-bold" : "sans");
	}
	// On a circle, a cut at the origin follows the last base.
	add(` (${record.circular && at === 0 ? record.bases.length : at})`, "sans");
	return labelOf(
		{
			kind: "cuts",
			name: enzymes.join(SEPARATOR),
			spans: [{ start: at, end: at }],
		},
		runs,
		ENZYME,
		highlight,
		{
			names: enzymes,
			fewestCuts: Math.min(...enzymes.map((enzyme) => counts.get(enzyme) ?? 0)),
		},
	);
}

/** Names in order whatever their case, and by case where that is all they differ by. */
function byName(a: string, b: string): number {
	const [x, y] = [folded(a), folded(b)];
	if (x !== y) return x < y ? -1 : 1;
	return a < b ? -1 : a > b ? 1 : 0;
}
