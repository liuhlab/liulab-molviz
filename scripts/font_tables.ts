/**
 * The viewer's font tables, read from the committed TTF subsets with opentype.js at build time,
 * so the viewer measures and outlines text as opentype.js does without carrying it.
 */

import { readFileSync } from "node:fs";
import type { FaceTable, Kerning } from "virtual:molviz-fonts";
import {
	type Font,
	type PathCommand,
	parse,
} from "opentype.js/dist/opentype.mjs";
import type { Plugin } from "vite";

const FOLDER = "src/viewer/fonts";
const FACES = ["sans", "sans-bold", "mono"] as const;
type Face = (typeof FACES)[number];

const FONTS = "virtual:molviz-fonts";
const OUTLINES = "virtual:molviz-outlines";

// The script the viewer kerns under: DejaVu files its kerning there.
const SCRIPT = "latn";

function font(face: Face): Font {
	return parse(new Uint8Array(readFileSync(`${FOLDER}/${face}.ttf`)).buffer);
}

function table(font: Font): FaceTable {
	const count = font.glyphs.length;
	const chars: Record<number, number> = {};
	for (const [code, index] of Object.entries(font.tables.cmap.glyphIndexMap))
		if (index > 0) chars[Number(code)] = index;
	const advances: number[] = [];
	for (let index = 0; index < count; index++)
		advances.push(font.glyphs.get(index).advanceWidth ?? 0);
	return {
		unitsPerEm: font.unitsPerEm,
		ascender: font.ascender,
		descender: font.descender,
		chars,
		advances,
		kerning: kerning(font, count),
	};
}

/**
 * The face's kerning as opentype.js applies it. Throws on any kerning but one class subtable,
 * the one form this reads.
 */
function kerning(font: Font, count: number): Kerning | null {
	const subtables = (font.position.getKerningTables(SCRIPT) ?? []).flatMap(
		(lookup) => lookup.subtables,
	);
	if (subtables.length === 0) {
		if (Object.keys(font.kerningPairs).length > 0)
			throw new Error("molviz fonts: a face kerns from a kern table");
		return null;
	}
	const [pairs] = subtables;
	if (subtables.length > 1 || pairs.posFormat !== 2)
		throw new Error("molviz fonts: a face's kerning is not one class subtable");
	const first: number[] = [];
	const second: number[] = [];
	for (let index = 0; index < count; index++) {
		first.push(
			font.position.getCoverageIndex(pairs.coverage, index) < 0
				? -1
				: font.position.getGlyphClass(pairs.classDef1, index),
		);
		second.push(font.position.getGlyphClass(pairs.classDef2, index));
	}
	const values = pairs.classRecords.map((row) =>
		row.map((pair) => pair.value1?.xAdvance || 0),
	);
	return { first, second, values };
}

/** Each inked glyph's outline at a size of one em, its numbers as JavaScript writes them. */
function outlines(font: Font): Record<number, string> {
	const out: Record<number, string> = {};
	for (let index = 0; index < font.glyphs.length; index++) {
		const glyph = font.glyphs.get(index);
		const d = pathData(glyph.getPath(0, 0, font.unitsPerEm).commands);
		if (d) out[index] = d;
	}
	return out;
}

function pathData(commands: readonly PathCommand[]): string {
	let d = "";
	for (const c of commands) {
		if (c.type === "Z") d += "Z";
		else if (c.type === "Q") d += `Q${c.x1} ${c.y1} ${c.x} ${c.y}`;
		else if (c.type === "C")
			d += `C${c.x1} ${c.y1} ${c.x2} ${c.y2} ${c.x} ${c.y}`;
		else d += `${c.type}${c.x} ${c.y}`;
	}
	return d;
}

/**
 * The Vite plugin serving the tables as modules: `virtual:molviz-fonts`, what the viewer measures
 * with, and `virtual:molviz-outlines`, each glyph's outline.
 */
export function fontTables(): Plugin {
	let built: { fonts: string; outlines: string } | undefined;
	const modules = () => {
		if (built) return built;
		const fonts = FACES.map((face) => [face, font(face)] as const);
		built = {
			fonts: JSON.stringify(
				Object.fromEntries(fonts.map(([face, f]) => [face, table(f)])),
			),
			outlines: JSON.stringify(
				Object.fromEntries(fonts.map(([face, f]) => [face, outlines(f)])),
			),
		};
		return built;
	};
	return {
		name: "molviz-font-tables",
		resolveId: (id) => (id === FONTS || id === OUTLINES ? `\0${id}` : null),
		load(id) {
			if (id === `\0${FONTS}`) return `export default ${modules().fonts};`;
			if (id === `\0${OUTLINES}`)
				return `export default ${modules().outlines};`;
			return null;
		},
	};
}
