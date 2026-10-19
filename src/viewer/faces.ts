/**
 * The faces' tables, which the build writes from the font subsets with opentype.js: each
 * character's glyph, each glyph's advance, and the kerning. Every sum is opentype.js's, in its
 * order, so every width and place is the one it gives.
 */

import tables, { type FaceTable } from "virtual:molviz-fonts";

/** The faces the viewer carries: DejaVu Sans, its bold, and DejaVu Sans Mono. */
export const FACES = ["sans", "sans-bold", "mono"] as const;

/** A face the viewer carries. */
export type Face = (typeof FACES)[number];

/** One glyph of a text, in its face's units. */
export interface Place {
	/** The glyph's index in its face. */
	readonly index: number;
	/** Where its origin sits, from where the text starts. */
	readonly x: number;
	/** How far it moves the next glyph on, before kerning. */
	readonly advance: number;
}

/** Whether `face` has a glyph for `character`. */
export function has(character: string, face: Face): boolean {
	return glyphOf(tables[face], character) > 0;
}

/** The advance width of `text`, every character in `face`, set at `size`, kerned. */
export function advance(text: string, face: Face, size: number): number {
	const table = tables[face];
	return walk(text, table, (1 / table.unitsPerEm) * size, () => {});
}

/** Each glyph of `text`, every character in `face`, and where it sits, kerned. */
export function places(text: string, face: Face): Place[] {
	const table = tables[face];
	const out: Place[] = [];
	// As opentype.js places glyphs at a size of one em.
	walk(text, table, (1 / table.unitsPerEm) * table.unitsPerEm, (index, x) =>
		out.push({ index, x, advance: table.advances[index] }),
	);
	return out;
}

/** `face`'s em, and how far it reaches above and below its baseline, in its units. */
export function units(face: Face): {
	unitsPerEm: number;
	ascender: number;
	descender: number;
} {
	const { unitsPerEm, ascender, descender } = tables[face];
	return { unitsPerEm, ascender, descender };
}

function glyphOf(table: FaceTable, character: string): number {
	return table.chars[character.codePointAt(0) as number] ?? 0;
}

/** Visit each glyph of `text` at its x, scaled by `scale`, and return the x past the last. */
function walk(
	text: string,
	table: FaceTable,
	scale: number,
	each: (index: number, x: number) => void,
): number {
	const indices = [...text].map((character) => glyphOf(table, character));
	let x = 0;
	for (let i = 0; i < indices.length; i++) {
		each(indices[i], x);
		const width = table.advances[indices[i]];
		if (width) x += width * scale;
		if (i < indices.length - 1)
			x += kern(table, indices[i], indices[i + 1]) * scale;
	}
	return x;
}

function kern(table: FaceTable, left: number, right: number): number {
	const { kerning } = table;
	if (!kerning || kerning.first[left] < 0) return 0;
	return kerning.values[kerning.first[left]][kerning.second[right]] ?? 0;
}
