/// <reference types="vite/client" />
/** Text in the faces the viewer carries: measured, and outlined as SVG paths. */

import { OUTLINES_GLOBAL } from "virtual:molviz-fonts";
import type { Outlines } from "virtual:molviz-outlines";
import { advance, FACES, type Face, has, places, units } from "./faces";
import monoUrl from "./fonts/mono.woff2?inline";
import sansUrl from "./fonts/sans.woff2?inline";
import sansBoldUrl from "./fonts/sans-bold.woff2?inline";
import { twoDecimals } from "./scene";

export type { Face } from "./faces";

/** The family a page declares each face under. No installed font has one, so none stands in. */
export const families: Record<Face, string> = {
	sans: "molviz Sans",
	"sans-bold": "molviz Sans",
	mono: "molviz Mono",
};

const urls: Record<Face, string> = {
	sans: sansUrl,
	"sans-bold": sansBoldUrl,
	mono: monoUrl,
};
/** The weight each face is declared at in its family. */
export const weights: Record<Face, number> = {
	sans: 400,
	"sans-bold": 700,
	mono: 400,
};

/**
 * `text` with each character `face` lacks replaced by U+FFFD, which it has.
 *
 * Text drawn as `<text>` must go through this too, or the browser finds the character in another
 * font and the width no longer matches `measure`.
 */
export function inFace(text: string, face: Face): string {
	let out = "";
	for (const character of text) out += has(character, face) ? character : "�";
	return out;
}

/** The advance width of `text` set in `face` at `size`, kerned, in the units of `size`. */
export function measure(text: string, face: Face, size: number): number {
	return advance(inFace(text, face), face, size);
}

/** How wide `text` is set in `face` at `size`, or, given `cell`, in cells that wide. */
export function textWidth(
	text: string,
	face: Face,
	size: number,
	cell?: number,
): number {
	return cell === undefined
		? measure(text, face, size)
		: [...text].length * cell;
}

/**
 * `text` broken into lines no wider than `width`, as many words to a line as fit, and none for
 * text with no word. A word wider than a line breaks between letters, and a letter wider than a
 * line takes a line alone.
 */
export function wrap(
	text: string,
	face: Face,
	size: number,
	width: number,
): string[] {
	const fits = (line: string) => measure(line, face, size) <= width;
	const lines: string[] = [];
	let line = "";
	for (const word of text.split(" ").filter(Boolean)) {
		const joined = line ? `${line} ${word}` : word;
		if (fits(joined)) {
			line = joined;
			continue;
		}
		if (line) lines.push(line);
		let rest = [...word];
		while (!fits(rest.join(""))) {
			let cut = 1;
			while (cut < rest.length && fits(rest.slice(0, cut + 1).join(""))) cut++;
			lines.push(rest.slice(0, cut).join(""));
			rest = rest.slice(cut);
		}
		line = rest.join("");
	}
	return line ? [...lines, line] : lines;
}

/** How far `face` reaches above and below its baseline, per unit of size. */
export function metrics(face: Face): { ascent: number; descent: number } {
	const { unitsPerEm, ascender, descender } = units(face);
	return { ascent: ascender / unitsPerEm, descent: -descender / unitsPerEm };
}

/** The height of a line of text in `face` at `size`. */
export function height(face: Face, size: number): number {
	const { ascent, descent } = metrics(face);
	return (ascent + descent) * size;
}

/** The baseline that centres a line of text in `face` at `size` on the height `middle`. */
export function baseline(face: Face, size: number, middle: number): number {
	const { ascent, descent } = metrics(face);
	return middle + ((ascent - descent) / 2) * size;
}

/** One glyph of a line of text, and where it sits. */
export interface Glyph {
	/** Names the glyph among every face's glyphs. */
	readonly id: string;
	/** The glyph's index in its face, which `outlineOf` takes. */
	readonly index: number;
	/** Where its origin sits, in the units of the line's size, from where the line starts. */
	readonly x: number;
}

/**
 * The glyphs drawing `text` in `face` at `size`: kerned, or with a `cell` width each centred in a
 * cell that wide, the cells side by side.
 */
export function glyphs(
	text: string,
	face: Face,
	size: number,
	cell?: number,
): Glyph[] {
	const scale = size / units(face).unitsPerEm;
	const placed = places(inFace(text, face), face);
	const glyph = (index: number, x: number) => ({
		id: `${face}-${index}`,
		index,
		x,
	});
	if (cell === undefined)
		return placed.map(({ index, x }) => glyph(index, x * scale));
	let start = 0;
	return placed.map(({ index, advance: width }) => {
		const centred = glyph(index, start + (cell - width * scale) / 2);
		start += cell;
		return centred;
	});
}

// Each outline read so far, with two decimals, by face and then glyph index.
const roundedOutlines: Partial<Record<Face, Map<number, string>>> = {};

/**
 * The outline of glyph `index` of `face` as SVG path data in its face's units, y down, from its
 * origin on the baseline, every number with two decimals. Empty for a glyph with no ink, such
 * as a space. Throws unless the outline script has run.
 */
export function outlineOf(face: Face, index: number): string {
	const scriptOutlines = (globalThis as Record<string, unknown>)[
		OUTLINES_GLOBAL
	] as Outlines | undefined;
	if (scriptOutlines === undefined)
		throw new Error("molviz: a file's outlines need the outline script");
	roundedOutlines[face] ??= new Map();
	const known = roundedOutlines[face];
	let outline = known.get(index);
	if (outline === undefined) {
		outline = (scriptOutlines[face][index] ?? "").replace(
			/-?\d+(\.\d+)?/g,
			(n) => twoDecimals(Number(n)),
		);
		known.set(index, outline);
	}
	return outline;
}

/** CSS `@font-face` rules declaring each face in its family, by weight, as a data URL. */
export function fontFaceCss(): string {
	return FACES.map(
		(face) =>
			`@font-face{font-family:"${families[face]}";font-weight:${weights[face]};` +
			`src:url(${urls[face]}) format("woff2")}`,
	).join("\n");
}
