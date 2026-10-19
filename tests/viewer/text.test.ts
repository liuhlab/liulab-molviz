import vm from "node:vm";
import { build, type Rolldown } from "vite";
import { describe, expect, test } from "vitest";
import { fontTables } from "../../scripts/font-tables";
import {
	fontFaceCss,
	glyphs,
	measure,
	metrics,
	outlineOf,
	wrap,
} from "../../src/viewer/text";

describe("measure", () => {
	test("sums the face's advance widths, scaled to the size", () => {
		expect(measure("BsaI", "sans", 12)).toBe(25.376953125);
		expect(measure("BsaI", "sans-bold", 12)).toBe(28.8515625);
	});

	test("applies the face's kerning, as a browser does", () => {
		expect(measure("AV", "sans", 12)).toBeLessThan(
			measure("A", "sans", 12) + measure("V", "sans", 12),
		);
		expect(measure("AVATo", "sans", 12)).toBe(34.79296875);
		expect(measure("AVATo", "sans-bold", 12)).toBe(40.13671875);
	});

	test("takes a character the face lacks as U+FFFD", () => {
		expect(measure("中", "sans", 12)).toBe(12.3046875);
		expect(measure("😀", "sans", 12)).toBe(12.3046875);
	});

	test("gives every letter of the mono face the same advance", () => {
		expect(measure("ACGT", "mono", 11)).toBe((4 * 1233 * 11) / 2048);
		expect(measure("W.i中", "mono", 11)).toBe((4 * 1233 * 11) / 2048);
	});
});

describe("metrics", () => {
	test("gives how far each face reaches above and below its baseline, per unit of size", () => {
		const expected = { ascent: 1901 / 2048, descent: 483 / 2048 };
		expect(metrics("sans")).toEqual(expected);
		expect(metrics("sans-bold")).toEqual(expected);
		expect(metrics("mono")).toEqual(expected);
	});
});

describe("fontFaceCss", () => {
	test("declares Sans at two weights, and Mono in a family of its own", () => {
		const declared = [
			...fontFaceCss().matchAll(/font-family:"([^"]+)";font-weight:(\d+);/g),
		].map((m) => `${m[1]} ${m[2]}`);
		expect(declared.sort()).toEqual([
			"molviz Mono 400",
			"molviz Sans 400",
			"molviz Sans 700",
		]);
	});

	test("loads each face as WOFF2 from a data URL", () => {
		const sources = [...fontFaceCss().matchAll(/src:([^}]*)\}/g)].map(
			([, source]) => source,
		);
		expect(sources).toHaveLength(3);
		for (const source of sources)
			expect(source).toMatch(
				/^url\(data:font\/woff2;base64,[A-Za-z0-9+/]+=*\) format\("woff2"\)$/,
			);
	});
});

describe("outlineOf", () => {
	test("gives a glyph's outline in its face's units, y down, from its origin", () => {
		const [glyph] = glyphs("I", "sans", 12);
		expect(glyph.x).toBe(0);
		expect(outlineOf("sans", glyph.index)).toBe(
			"M201.00 0.00L201.00 -1493.00L403.00 -1493.00L403.00 0.00L201.00 0.00",
		);
	});

	test("gives a glyph with no ink, such as a space, no outline", () => {
		expect(outlineOf("sans", glyphs("a b", "sans", 10)[1].index)).toBe("");
	});
});

describe("glyphs", () => {
	test("names a glyph the same wherever it is set, and apart from other faces' glyphs", () => {
		const [first, second] = glyphs("II", "sans", 12);
		expect(first.id).toBe(second.id);
		expect(glyphs("I", "sans-bold", 30)[0].id).not.toBe(first.id);
		expect(glyphs("I", "mono", 12)[0].id).not.toBe(first.id);
		expect(glyphs("J", "sans", 12)[0].id).not.toBe(first.id);
	});

	test("sets each glyph at the kerned advance of those before it", () => {
		expect(glyphs("AV", "sans", 2048).map((g) => g.x)).toEqual([0, 1270]);
		expect(glyphs("AV", "sans", 12).map((g) => g.x)).toEqual([
			0,
			(1270 * 12) / 2048,
		]);
	});

	test("centres each glyph in a cell of its own, the cells side by side", () => {
		const margin = (11 - (1233 * 11) / 2048) / 2;
		expect(glyphs("ACGT", "mono", 11, 11).map((g) => g.x)).toEqual(
			[0, 11, 22, 33].map((start) => start + margin),
		);
		expect(glyphs("iW", "sans", 10, 12).map((g) => g.x)).toEqual([
			(12 - measure("i", "sans", 10)) / 2,
			12 + (12 - measure("W", "sans", 10)) / 2,
		]);
	});

	test("takes a character the face lacks as U+FFFD, one glyph to a cell", () => {
		const [lacked] = glyphs("中", "mono", 11, 11);
		expect(glyphs("😀A", "mono", 11, 11)).toEqual([
			lacked,
			{ ...glyphs("A", "mono", 11, 11)[0], x: 11 + lacked.x },
		]);
		expect(lacked.id).toBe(glyphs("\ufffd", "mono", 11)[0].id);
	});
});

describe("wrap", () => {
	test("breaks at spaces, putting as many words on each line as fit", () => {
		const width = measure("aa bb", "sans", 10);
		expect(wrap("aa bb cc dd", "sans", 10, width)).toEqual(["aa bb", "cc dd"]);
	});

	test("breaks a word too long for a line between letters", () => {
		const width = measure("abc", "sans", 10);
		expect(wrap("abcdefgh", "sans", 10, width)).toEqual(["abc", "def", "gh"]);
	});

	test("gives a letter wider than the line a line of its own", () => {
		expect(wrap("ab", "sans", 10, 1)).toEqual(["a", "b"]);
	});

	test("gives no lines for text with no words", () => {
		expect(wrap("", "sans", 10, 100)).toEqual([]);
		expect(wrap("   ", "sans", 10, 100)).toEqual([]);
	});
});

test("runs bundled in a bare V8 context, with no DOM, to the same results", async () => {
	const [bundle] = (await build({
		configFile: false,
		logLevel: "silent",
		plugins: [fontTables()],
		build: {
			write: false,
			minify: false,
			lib: { entry: "src/viewer/text.ts", formats: ["iife"], name: "text" },
		},
	})) as Rolldown.RolldownOutput[];
	const context = vm.createContext(Object.create(null));
	vm.runInContext(bundle.output[0].code, context);
	const call = (expression: string) =>
		vm.runInContext(`text.${expression}`, context);

	expect(call('measure("AVATo", "sans", 12)')).toBe(34.79296875);
	expect(call('glyphs("GFP (1..720)", "sans-bold", 11)')).toEqual(
		glyphs("GFP (1..720)", "sans-bold", 11),
	);
});
