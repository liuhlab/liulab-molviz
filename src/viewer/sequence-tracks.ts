/** The sequence view's tracks: each a strip of curves under the rows its peaks reach. */

import { SMALL_SIZE } from "./labels";
import type { Options } from "./options";
import { CURVES, INK, painted, RAIL, unlit } from "./paint";
import { turns } from "./pieces";
import {
	type Bounds,
	type Record,
	recordBounds,
	type Span,
	type Track,
} from "./record";
import type { Box, PathCommand, Shape } from "./scene";
import type { Row, Shelf } from "./sequence";
import { shownTracks } from "./shown";
import { baseline, height, measure } from "./text";

// The room above a strip's name and under it, and the curves' height.
const STRIP_GAP = 6;
const NAME_GAP = 2;
const STRIP = 40;

/** A curve's thickness, and the line along a strip's foot's. */
const CURVE_WIDTH = 0.8;
const FOOT_WIDTH = 0.5;

/** Each base a track has a curve of, in the order its key lists them. */
const LETTERS = ["A", "C", "G", "T"] as const;

/** A sample's index, and where it lies in bases, counted as the span counts them. */
type Sample = readonly [sample: number, at: number];

/** What a row draws of one track: its runs of samples there. */
export interface Sampled {
	readonly track: Track;
	readonly runs: readonly (readonly Sample[])[];
}

/**
 * For each row of the sequence view `options` give of `record`, what it draws of each track it
 * reaches, in the record's order.
 */
export function sampledRows(record: Record, options: Options): Sampled[][] {
	const { span, bases_per_row: perRow } = options;
	const rows: Sampled[][] = Array.from(
		{ length: Math.ceil((span.end - span.start) / perRow) },
		() => [],
	);
	for (const track of shownTracks(record, options)) {
		const byRow = new Map<number, Sample[][]>();
		for (const run of sampled(track, span, recordBounds(record))) {
			const split = new Map<number, Sample[]>();
			for (const sample of run) {
				const row = Math.floor((sample[1] - span.start) / perRow);
				const samples = split.get(row) ?? [];
				samples.push(sample);
				split.set(row, samples);
			}
			for (const [row, samples] of split) {
				byRow.set(row, [...(byRow.get(row) ?? []), samples]);
			}
		}
		for (const [row, runs] of [...byRow].sort(([a], [b]) => a - b)) {
			rows[row].push({ track, runs });
		}
	}
	return rows;
}

/**
 * A track's runs of samples in `span` of a record within `bounds`. A peak lies over the middle of
 * its base; peaks over neighbouring bases join, each sample between them placed evenly, and a
 * run reaches half a step past each end. A peak that joins neither neighbour draws nothing.
 */
function sampled(track: Track, span: Span, bounds: Bounds): Sample[][] {
	const runs: Sample[][] = [];
	let last: Sample | null = null;
	for (const [sample, base] of track.peaks) {
		const at = turns(bounds)
			.map((shift) => base + shift)
			.find((p) => span.start <= p && p < span.end);
		if (at === undefined) {
			last = null;
			continue;
		}
		const peak = [sample, at + 0.5] as const;
		if (last !== null && Math.abs(peak[1] - last[1]) === 1) {
			runs[runs.length - 1].push(peak);
		} else {
			runs.push([peak]);
		}
		last = peak;
	}
	const count = track.curves.A.length;
	return runs
		.filter((run) => run.length > 1)
		.map((run) => placed(run, span, count))
		.filter((run) => run.length > 0);
}

/** Every sample of `run`'s reach that lies in `span`, placed between its peaks. */
function placed(run: readonly Sample[], span: Span, count: number): Sample[] {
	const [first, second] = run;
	const [before, final] = run.slice(-2);
	const knots = [beyond(first, second), ...run, beyond(final, before)];
	// Half-open, so a run ending where the next starts shares no sample with it.
	const low = Math.max(0, Math.ceil(knots[0][0]));
	const high = Math.min(count, Math.ceil(knots[knots.length - 1][0])) - 1;
	const out: Sample[] = [];
	let k = 1;
	for (let sample = low; sample <= high; sample++) {
		while (k < knots.length - 1 && knots[k][0] <= sample) k++;
		const [s0, x0] = knots[k - 1];
		const [s1, x1] = knots[k];
		const at = x0 + ((x1 - x0) * (sample - s0)) / (s1 - s0);
		if (span.start <= at && at < span.end) out.push([sample, at]);
	}
	return out;
}

/** The knot half a step past `end`, away from its neighbour `inner`. */
function beyond(end: Sample, inner: Sample): Sample {
	return [end[0] + (end[0] - inner[0]) / 2, end[1] + (end[1] - inner[1]) / 2];
}

/**
 * The strip of each track `row` draws, one under another from the height `top`: its name and
 * key, its curves scaled so the highest value the row draws reaches the strip's top and 0 lies at
 * its foot.
 */
export function strips(
	row: Row,
	tracks: readonly Sampled[],
	top: number,
): Shelf {
	const shapes: Shape[] = [];
	const covers: Box[] = [];
	const width = row.at(row.end);
	let y = top;
	for (const { track, runs } of tracks) {
		const dim = unlit(row.options.highlight, [track.name]);
		y += STRIP_GAP;
		shapes.push(...key(track.name, y, dim));
		y += height("sans", SMALL_SIZE) + NAME_GAP;
		const foot = y + STRIP;
		covers.push({ x: 0, y, width, height: STRIP });
		let highest = 0;
		for (const run of runs) {
			for (const [sample] of run) {
				for (const letter of LETTERS) {
					highest = Math.max(highest, track.curves[letter][sample]);
				}
			}
		}
		const scale = highest > 0 ? STRIP / highest : 0;
		shapes.push({
			shape: "line",
			x1: 0,
			y1: foot,
			x2: width,
			y2: foot,
			stroke: painted(RAIL, dim),
			strokeWidth: FOOT_WIDTH,
		});
		for (const run of runs) {
			for (const letter of LETTERS) {
				const values = track.curves[letter];
				shapes.push({
					shape: "path",
					commands: run.map(
						([sample, at], i): PathCommand => [
							i === 0 ? "M" : "L",
							row.at(at),
							foot - Math.max(values[sample], 0) * scale,
						],
					),
					fill: "none",
					stroke: painted(CURVES[letter], dim),
					strokeWidth: CURVE_WIDTH,
				});
			}
		}
		y = foot;
	}
	return { shapes, labels: [], covers, bottom: y };
}

/** A strip's name from x = 0, its top at `top`, then the key: each curve's letter in its colour. */
function key(name: string, top: number, dim: boolean): Shape[] {
	const y = baseline("sans", SMALL_SIZE, top + height("sans", SMALL_SIZE) / 2);
	const space = measure(" ", "sans", SMALL_SIZE);
	const text = (text: string, x: number, fill: string): Shape => ({
		shape: "text",
		text,
		face: "sans",
		size: SMALL_SIZE,
		x,
		y,
		anchor: "start",
		fill: painted(fill, dim),
	});
	const shapes: Shape[] = [];
	let x = 0;
	if (name.trim() !== "") {
		shapes.push(text(name, x, INK));
		x += measure(name, "sans", SMALL_SIZE) + 2 * space;
	}
	for (const letter of LETTERS) {
		shapes.push(text(letter, x, CURVES[letter]));
		x += measure(letter, "sans", SMALL_SIZE) + space;
	}
	return shapes;
}
