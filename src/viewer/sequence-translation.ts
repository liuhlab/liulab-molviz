/** The amino-acid chips over a translated feature's bar in the sequence view. */

import type { Bar } from "./arrows";
import { OUTLINE_WIDTH, painted, shaded, textColor } from "./paint";
import type { Record } from "./record";
import type { Shape } from "./scene";
import type { Lane, Row } from "./sequence";
import { baseline } from "./text";

type Feature = Record["features"][number];

/** A chip's height, how far its point and notch reach along the row, and the room under it. */
const CHIP = 15;
const POINT = 3;
const CHIP_GAP = 1;

/** The size a chip's letter is set at. */
const LETTER_SIZE = 11;

/** SeqViz's chip colours as they show at its 0.7 opacity on white, taken by a letter's code. */
// biome-ignore format: a table reads better packed
const PALETTE = [
	"#baf0f2", "#b1e8af", "#ddf6a8", "#afe8d1", "#f5bfdd", "#f9d79c",
	"#f5a5a5", "#fcc2ab", "#f5b8f9", "#d6baff", "#97a7ff", "#aac1ff",
];

/** A stop's chip. */
const STOP = "#cc3311";

/** One codon's bases next to one another in a row, as the span counts them. */
interface Run {
	readonly codon: number;
	readonly start: number;
	end: number;
	/** Whether it holds the codon's middle base, where the letter goes. */
	middle: boolean;
}

/**
 * The chips of `feature` over its `bar` in `row`, in a lane from `top` down: a chevron over each
 * codon's bases there, pointing along the strand, its letter where its middle base is. A feature
 * with no translation has none.
 */
export function chips(feature: Feature, bar: Bar, row: Row, top: number): Lane {
	const { translation } = feature;
	if (translation === undefined) return { shapes: [], labels: [], bottom: top };
	const shapes: Shape[] = [];
	const middle = top + CHIP / 2;
	const point = feature.strand === -1 ? -POINT : POINT;
	for (const run of runs(feature, translation, bar, row)) {
		const x1 = row.at(run.start);
		const x2 = row.at(run.end);
		const letter = translation[run.codon];
		const fill = painted(
			letter === "*" ? STOP : PALETTE[letter.charCodeAt(0) % PALETTE.length],
			bar.label.dim,
		);
		shapes.push({
			shape: "polygon",
			points: [
				[x1, top],
				[x2, top],
				[x2 + point, middle],
				[x2, top + CHIP],
				[x1, top + CHIP],
				[x1 + point, middle],
			],
			fill,
			stroke: shaded(fill),
			strokeWidth: OUTLINE_WIDTH,
		});
		if (!run.middle) continue;
		shapes.push({
			shape: "text",
			text: letter,
			face: "mono",
			size: LETTER_SIZE,
			x: (x1 + x2) / 2,
			y: baseline("mono", LETTER_SIZE, middle),
			anchor: "middle",
			fill: textColor(fill),
		});
	}
	const bottom = shapes.length ? top + CHIP + CHIP_GAP : top;
	return { shapes, labels: [], bottom };
}

/**
 * The runs of `feature`'s codons in `row` under `bar`. Its segments are read in order along its
 * strand, from `codon_start`, each codon the next three bases.
 */
function runs(
	{ segments, strand, codon_start = 1 }: Feature,
	translation: string,
	bar: Bar,
	{ start, end, at, bounds }: Row,
): Run[] {
	const reverse = strand === -1;
	const sign = reverse ? -1 : 1;
	const total = segments.reduce((sum, s) => sum + s.end - s.start, 0);
	const found: Run[] = [];
	let before = 0;
	for (const segment of segments) {
		const width = segment.end - segment.start;
		// The base at `p` in the segment is read `offset + sign * p`th from `codon_start`, from 0.
		const offset =
			(reverse
				? total - before - width + segment.end - 1
				: before - segment.start) -
			(codon_start - 1);
		before += width;
		const shifts = bounds.circular ? [-bounds.length, 0, bounds.length] : [0];
		for (const shift of shifts) {
			const from = Math.max(segment.start + shift, start);
			const to = Math.min(segment.end + shift, end);
			if (from >= to) continue;
			// Only the segment's piece in this bar, not in another bar of the feature.
			if (!bar.arrows.some((a) => a.start === at(from) && a.end === at(to))) {
				continue;
			}
			for (let position = from; position < to; position++) {
				const read = offset + sign * (position - shift);
				const codon = Math.floor(read / 3);
				if (read < 0 || codon >= translation.length) continue;
				const last = found[found.length - 1];
				if (last?.codon === codon && last.end === position) {
					last.end += 1;
					last.middle ||= read % 3 === 1;
				} else {
					found.push({
						codon,
						start: position,
						end: position + 1,
						middle: read % 3 === 1,
					});
				}
			}
		}
	}
	return found;
}
