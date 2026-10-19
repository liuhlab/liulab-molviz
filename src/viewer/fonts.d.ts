// The modules the build writes from the font subsets: see `scripts/font-tables.ts`.

declare module "virtual:molviz-fonts" {
	/** What the viewer knows of one face, in the face's units. */
	export interface FaceTable {
		readonly unitsPerEm: number;
		readonly ascender: number;
		readonly descender: number;
		/** Each character's glyph, by its code point; a character the face lacks is absent. */
		readonly chars: Readonly<Record<number, number>>;
		/** Each glyph's advance, by its index. */
		readonly advances: readonly number[];
		/** The kerning by class, or null for a face with none. */
		readonly kerning: Kerning | null;
	}

	/** Pair kerning: the value for a left glyph's class and a right glyph's class. */
	export interface Kerning {
		/** Each glyph's class on the left, by its index, or −1 for a glyph never kerned on the left. */
		readonly first: readonly number[];
		/** Each glyph's class on the right, by its index. */
		readonly second: readonly number[];
		/** The kerning by left class, then right class. */
		readonly values: readonly (readonly number[])[];
	}

	/** The global the outline script sets, holding what `virtual:molviz-outlines` holds. */
	export const OUTLINES_GLOBAL: string;

	const tables: Readonly<Record<import("./faces").Face, FaceTable>>;
	export default tables;
}

declare module "virtual:molviz-outlines" {
	/**
	 * Each glyph's outline by face, then by index, as SVG path data in its face's units, y down,
	 * each number as JavaScript writes it. A glyph with no ink is absent.
	 */
	export type Outlines = Readonly<
		Record<import("./faces").Face, Readonly<Record<number, string>>>
	>;
	const outlines: Outlines;
	export default outlines;
}
