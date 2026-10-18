import { describe, expect, test } from "vitest";
import { svg } from "../../src/viewer/drawing";
import { FormatError } from "../../src/viewer/record";

const good = { name: "p", circular: false, bases: "ACGT".repeat(25) };

describe("svg", () => {
	test("checks the record", () => {
		expect(() => svg({ ...good, bases: "" }, {})).toThrow(
			new FormatError("bases: must hold at least one base"),
		);
	});

	test("checks the options against the record", () => {
		expect(() => svg(good, { span: { start: 0, end: 101 } })).toThrow(
			new FormatError(
				"options.span.end: must be at most the record's length, 100",
			),
		);
	});

	test("sizes the drawing with no unit, so one unit is one point", () => {
		const root = /^<svg\b[^>]*>/.exec(svg(good).svg)?.[0] ?? "";
		const size = (name: string) =>
			Number(new RegExp(`\\s${name}="([^"]*)"`).exec(root)?.[1]);
		expect(size("width")).toBeGreaterThan(0);
		expect(size("height")).toBeGreaterThan(0);
	});

	test("draws the line, as the only page, hiding nothing", () => {
		const drawn = svg({
			...good,
			features: [
				{
					name: "orf",
					type: "CDS",
					strand: 1,
					segments: [{ start: 10, end: 60 }],
				},
			],
		});
		expect(drawn.svg).toContain('fill="#77aadd"');
		expect(drawn.pages).toEqual([drawn.svg]);
		expect(drawn.hidden).toEqual([]);
		expect(drawn.notice).toBe("");
	});
});
