/**
 * What of a record every view draws: each kind the options leave on, gathered once. Kinds drawn
 * alike come in pairs: features and disagreements over a span as bars, primer sites and reads
 * as thin arrows, and insertions and disagreements at a point as marks.
 */

import {
	type ColoredFeature,
	coloredFeatures,
	disagreementBars,
} from "./arrows";
import { type CutSite, cutSites } from "./cuts";
import type { Options } from "./format/options";
import { type Record, recordBounds, type Track } from "./format/record";
import {
	disagreementLabel,
	insertionLabel,
	type Label,
	primerLabel,
	readLabel,
} from "./labels";

/** Each feature, then each disagreement over a span, drawn as bars. */
export function shownBars(record: Record, options: Options): ColoredFeature[] {
	const off = new Set(options.kinds_off);
	return [
		...(off.has("features") ? [] : coloredFeatures(record, options)),
		...(off.has("disagreements") ? [] : disagreementBars(record, options)),
	];
}

/** A primer site or a read: bases lying along one strand, drawn as a thin arrow. */
export interface Aligned {
	/** The primer site or the read, as the record gives it. */
	readonly item: object;
	readonly start: number;
	readonly end: number;
	readonly strand: 1 | -1;
	readonly label: Label;
	/** How many bases a primer's 5' tail adds past its site; none for a read. */
	readonly tailLength: number;
	/** The bases it marks, as the record counts them. */
	readonly marked: readonly number[];
}

/**
 * Each primer site, then each read. A primer marks the bases it does not pair with; a read, those
 * of each disagreement over a span that names it.
 */
export function shownSites(record: Record, options: Options): Aligned[] {
	const off = new Set(options.kinds_off);
	const { highlight } = options;
	const { length } = record.bases;
	const found: Aligned[] = [];
	if (!off.has("primers")) {
		for (const { name, bases, sites } of record.primers) {
			for (const site of sites) {
				const { start, end, strand } = site;
				found.push({
					item: site,
					start,
					end,
					strand,
					label: primerLabel(name, site, length, highlight),
					tailLength: bases.length - (end - start),
					marked: site.mismatches ?? [],
				});
			}
		}
	}
	if (off.has("reads")) return found;
	for (const read of record.reads) {
		const { start, end, strand, name } = read;
		found.push({
			item: read,
			start,
			end,
			strand,
			label: readLabel(read, length, highlight),
			tailLength: 0,
			marked: off.has("disagreements") ? [] : disagreed(record, name),
		});
	}
	return found;
}

/** Each base of each disagreement over a span that names the read `name`. */
function disagreed(record: Record, name: string): number[] {
	const found: number[] = [];
	for (const one of record.disagreements) {
		if (one.at !== undefined || !one.reads.includes(name)) continue;
		for (let base = one.start; base < one.end; base++) found.push(base);
	}
	return found;
}

/** An insertion or a disagreement at a point: where it lies, its label, and its hover. */
export interface Mark {
	readonly at: number;
	readonly label: Label;
	readonly hover: string;
}

/** Each insertion, then each disagreement at a point, drawn as marks. */
export function shownMarks(record: Record, options: Options): Mark[] {
	const off = new Set(options.kinds_off);
	const bounds = recordBounds(record);
	const { highlight } = options;
	const found: Mark[] = [];
	if (!off.has("insertions")) {
		for (const insertion of record.insertions) {
			const { label, hover } = insertionLabel(insertion, bounds, highlight);
			found.push({ at: insertion.at, label, hover });
		}
	}
	if (off.has("disagreements")) return found;
	for (const one of record.disagreements) {
		if (one.at === undefined) continue;
		found.push({ at: one.at, ...disagreementLabel(one, bounds, highlight) });
	}
	return found;
}

/** The cut sites of the enzymes the options leave on. */
export function shownCuts(record: Record, options: Options): CutSite[] {
	return options.kinds_off.includes("cuts")
		? []
		: cutSites(record, options.enzymes, options.highlight);
}

/** Each track, which only the sequence view draws. */
export function shownTracks(
	record: Record,
	options: Options,
): readonly Track[] {
	return options.kinds_off.includes("tracks") ? [] : record.tracks;
}
