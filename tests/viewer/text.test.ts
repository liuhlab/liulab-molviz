import vm from "node:vm";
import { build, type Rolldown } from "vite";
import { describe, expect, test } from "vitest";
import { measure, metrics, outline } from "../../src/viewer/text";

// Expected widths are the faces' advance widths and `kern` pairs, read from the subsets with
// fontTools. Both faces have 2048 units to the em.

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
});

describe("metrics", () => {
	test("gives how far each face reaches above and below its baseline, per unit of size", () => {
		// Both faces' `hhea` ascender is 1901 and descender -483, read with fontTools.
		const expected = { ascent: 1901 / 2048, descent: 483 / 2048 };
		expect(metrics("sans")).toEqual(expected);
		expect(metrics("sans-bold")).toEqual(expected);
	});
});

describe("outline", () => {
	test("places the face's contours at x on the baseline y, scaled to the size", () => {
		// Glyph I is the rectangle (201, 0) to (403, 1493) in font units.
		expect(outline("I", "sans", 12, 10.5, 20.25)).toBe(
			"M11.68 20.25L11.68 11.50L12.86 11.50L12.86 20.25L11.68 20.25",
		);
	});

	test("sets each glyph at the kerned advance of those before it", () => {
		// At 2048 one unit is one font unit: V starts at A's advance, 1401, less the pair's 131.
		expect(outline("AV", "sans", 2048, 0, 0)).toBe(
			outline("A", "sans", 2048, 0, 0) + outline("V", "sans", 2048, 1270, 0),
		);
	});
});

test("runs bundled in a bare V8 context, with no DOM, to the same results", async () => {
	const [bundle] = (await build({
		configFile: false,
		logLevel: "silent",
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
	expect(call('outline("GFP (1..720)", "sans-bold", 11, 3.3, 7.7)')).toBe(
		outline("GFP (1..720)", "sans-bold", 11, 3.3, 7.7),
	);
});
