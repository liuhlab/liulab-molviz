/// <reference types="vite/client" />
/** Text in the faces the viewer carries: measured, and outlined as SVG paths. */

import { type Font, parse } from "opentype.js";
import monoUrl from "./fonts/mono.ttf?inline";
import sansUrl from "./fonts/sans.ttf?inline";
import sansBoldUrl from "./fonts/sans-bold.ttf?inline";
import { twoDecimals } from "./scene";

/** A face the viewer carries: DejaVu Sans, its bold, or DejaVu Sans Mono. */
export type Face = "sans" | "sans-bold" | "mono";

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
const fonts: Partial<Record<Face, Font>> = {};

function font(face: Face): Font {
	fonts[face] ??= parse(bytes(urls[face]));
	return fonts[face];
}

const base64Alphabet =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** The bytes of a base64 data URL, decoded by hand: mini-racer has no `atob`. */
function bytes(url: string): ArrayBuffer {
	const text = url.slice(url.indexOf(",") + 1).replace(/=+$/, "");
	const value = new Uint8Array(128);
	for (let i = 0; i < base64Alphabet.length; i++)
		value[base64Alphabet.charCodeAt(i)] = i;
	const out = new Uint8Array((text.length * 3) >> 2);
	let bits = 0;
	let held = 0;
	let o = 0;
	for (let i = 0; i < text.length; i++) {
		bits = (bits << 6) | value[text.charCodeAt(i)];
		held += 6;
		if (held >= 8) {
			held -= 8;
			out[o++] = (bits >> held) & 255;
		}
	}
	return out.buffer;
}

// DejaVu files its kerning under the Latin script, and opentype.js reads only the default
// script unless told.
const kerned = { script: "latn" };

/**
 * `text` with each character `face` lacks replaced by U+FFFD, which it has.
 *
 * Text drawn as `<text>` must go through this too, or the browser finds the character in another
 * font and the width no longer matches `measure`.
 */
export function inFace(text: string, face: Face): string {
	const f = font(face);
	let out = "";
	for (const character of text) out += f.hasChar(character) ? character : "�";
	return out;
}

/** The advance width of `text` set in `face` at `size`, kerned, in the units of `size`. */
export function measure(text: string, face: Face, size: number): number {
	return font(face).getAdvanceWidth(inFace(text, face), size, kerned);
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
	const f = font(face);
	return {
		ascent: f.ascender / f.unitsPerEm,
		descent: -f.descender / f.unitsPerEm,
	};
}

/** The baseline that centres a line of text in `face` at `size` on the height `middle`. */
export function baseline(face: Face, size: number, middle: number): number {
	const { ascent, descent } = metrics(face);
	return middle + ((ascent - descent) / 2) * size;
}

/**
 * SVG path data drawing `text` in `face` at `size`, starting at `x` on the baseline `y`.
 *
 * Every number has two decimals, so the same text always gives the same string.
 */
export function outline(
	text: string,
	face: Face,
	size: number,
	x: number,
	y: number,
): string {
	const path = font(face).getPath(inFace(text, face), x, y, size, kerned);
	let d = "";
	for (const c of path.commands) {
		if (c.type === "Z") d += "Z";
		else if (c.type === "Q")
			d += `Q${twoDecimals(c.x1)} ${twoDecimals(c.y1)} ${twoDecimals(c.x)} ${twoDecimals(c.y)}`;
		else if (c.type === "C")
			d += `C${twoDecimals(c.x1)} ${twoDecimals(c.y1)} ${twoDecimals(c.x2)} ${twoDecimals(c.y2)} ${twoDecimals(c.x)} ${twoDecimals(c.y)}`;
		else d += `${c.type}${twoDecimals(c.x)} ${twoDecimals(c.y)}`;
	}
	return d;
}

/** CSS `@font-face` rules declaring each face in its family, by weight, as a data URL. */
export function fontFaceCss(): string {
	return (Object.keys(urls) as Face[])
		.map(
			(face) =>
				`@font-face{font-family:"${families[face]}";font-weight:${weights[face]};` +
				`src:url(${urls[face]}) format("truetype")}`,
		)
		.join("\n");
}
