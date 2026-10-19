import vm from "node:vm";
import { build, type Rolldown } from "vite";
import { describe, expect, test } from "vitest";
import {
	fontFaceCss,
	measure,
	metrics,
	outline,
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
});

describe("outline", () => {
	test("places the face's contours at x on the baseline y, scaled to the size", () => {
		expect(outline("I", "sans", 12, 10.5, 20.25)).toBe(
			"M11.68 20.25L11.68 11.50L12.86 11.50L12.86 20.25L11.68 20.25",
		);
	});

	test("sets each glyph at the kerned advance of those before it", () => {
		expect(outline("AV", "sans", 2048, 0, 0)).toBe(
			outline("A", "sans", 2048, 0, 0) + outline("V", "sans", 2048, 1270, 0),
		);
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
