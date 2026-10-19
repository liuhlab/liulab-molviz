// opentype.js ships no types. These cover what the build and the tests call. The ESM build by
// path: Node loads the bare name's CommonJS build in the Vite config, which names no exports.
declare module "opentype.js/dist/opentype.mjs" {
	export type PathCommand =
		| { type: "M" | "L"; x: number; y: number }
		| { type: "Q"; x1: number; y1: number; x: number; y: number }
		| {
				type: "C";
				x1: number;
				y1: number;
				x2: number;
				y2: number;
				x: number;
				y: number;
		  }
		| { type: "Z" };

	export interface RenderOptions {
		script?: string;
	}

	export interface Glyph {
		index: number;
		advanceWidth?: number;
		getPath(
			x: number,
			y: number,
			fontSize: number,
		): { commands: PathCommand[] };
	}

	/** A pair-adjustment subtable of the GPOS `kern` feature. */
	export interface PairSubtable {
		posFormat: number;
		coverage: unknown;
		classDef1: unknown;
		classDef2: unknown;
		classRecords: { value1?: { xAdvance?: number } }[][];
	}

	export interface Font {
		ascender: number;
		descender: number;
		unitsPerEm: number;
		glyphs: { length: number; get(index: number): Glyph };
		kerningPairs: Record<string, number>;
		tables: { cmap: { glyphIndexMap: Record<string, number> } };
		position: {
			getKerningTables(
				script: string,
			): { subtables: PairSubtable[] }[] | undefined;
			getCoverageIndex(coverage: unknown, glyph: number): number;
			getGlyphClass(classDef: unknown, glyph: number): number;
		};
		hasChar(character: string): boolean;
		getAdvanceWidth(
			text: string,
			fontSize: number,
			options?: RenderOptions,
		): number;
		forEachGlyph(
			text: string,
			x: number,
			y: number,
			fontSize: number,
			options: RenderOptions,
			callback: (glyph: Glyph, x: number, y: number, fontSize: number) => void,
		): number;
	}

	export function parse(buffer: ArrayBuffer): Font;
}
