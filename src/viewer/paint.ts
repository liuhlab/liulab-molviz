/** The colours a map paints, which the line and the circle share. Each is written `#rrggbb`. */

import { folded } from "./format";
import type { Record } from "./record";

/** The colour of each group of feature types, by the types it holds. */
// Paul Tol's light scheme, with `#aa3377` from his bright scheme.
// biome-ignore format: a table reads better packed
const GROUPS: readonly [color: string, types: readonly string[]][] = [
	[
		"#77aadd",
		[
			"CDS", "gene", "mat_peptide", "sig_peptide", "transit_peptide", "propeptide",
			"proprotein", "exon", "C_region", "D_segment", "J_segment", "N_region", "S_region",
			"V_region", "V_segment",
		],
	],
	[
		"#ee8866",
		[
			"promoter", "enhancer", "RBS", "-10_signal", "-35_signal", "CAAT_signal",
			"TATA_signal", "GC_signal", "attenuator", "misc_signal", "5'UTR", "regulatory",
		],
	],
	["#ffaabb", ["terminator", "polyA_signal", "polyA_site", "3'UTR"]],
	["#eedd88", ["rep_origin", "oriT"]],
	["#99ddff", ["protein_bind", "misc_binding"]],
	[
		"#44bb99",
		["ncRNA", "misc_RNA", "mRNA", "tRNA", "rRNA", "tmRNA", "precursor_RNA", "prim_transcript"],
	],
	["#bbcc33", ["LTR", "repeat_region", "mobile_element", "misc_recomb", "stem_loop", "D-loop"]],
	["#aa3377", ["primer_bind"]],
];

/** The colour of a type in no group. */
const OTHER = "#dddddd";

const DEFAULTS = new Map(
	GROUPS.flatMap(([color, types]) => types.map((t) => [t, color])),
);

/** A primer's arrow and label. */
export const PRIMER = "#aa3377";

/** A cut site's label. */
export const ENZYME = "#000000";

/** An insertion's mark and label, where it has no colour of its own. */
export const INSERTION = "#cc3311";

/** The one grey every paint of an item a highlight leaves unlit takes. */
export const DIM = "#dddddd";

/** The backbone, the ruler and the title. */
export const INK = "#252525";

/** The thin line across the gap between two segments of a feature. */
export const CONNECTOR = "#666666";

/** The line from a label to what it names. */
export const LEADER = "#7f7f7f";

/** The width of an arrow's outline, and of a box's. */
export const OUTLINE_WIDTH = 0.8;

/** How much of each channel of its fill an outline keeps. */
const OUTLINE_SHADE = 0.45;

type Feature = Record["features"][number];

/** The colour `segment` of `feature` fills: its own, else the feature's, else its type's. */
export function colorOf(
	feature: Feature,
	segment: Feature["segments"][number],
): string {
	const color =
		segment.color ?? feature.color ?? DEFAULTS.get(feature.type) ?? OTHER;
	return color.toLowerCase();
}

/**
 * Whether `highlight` leaves unlit an item that answers to `names`: it names none of them,
 * whatever their case. Nothing is unlit when it names nothing.
 */
export function unlit(
	highlight: readonly string[],
	names: readonly string[],
): boolean {
	if (highlight.length === 0) return false;
	const lit = new Set(highlight.map(folded));
	return !names.some((name) => lit.has(folded(name)));
}

/** `color`, or `DIM` for an item a highlight leaves unlit. */
export function painted(color: string, dim: boolean): string {
	return dim ? DIM : color;
}

/** `color` darkened, so even a white arrow's outline shows on a white ground. */
export function shaded(color: string): string {
	return `#${channels(color)
		.map((c) =>
			Math.round(OUTLINE_SHADE * c)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

/** Black or white, whichever contrasts more with `fill` by WCAG 2's ratio, black on a tie. */
export function textColor(fill: string): string {
	const [r, g, b] = channels(fill).map((c) => {
		const v = c / 255;
		return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05)
		? "#000000"
		: "#ffffff";
}

function channels(color: string): [number, number, number] {
	return [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16)) as [
		number,
		number,
		number,
	];
}
