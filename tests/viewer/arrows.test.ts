import { describe, expect, test } from "vitest";
import { disagreementBars } from "../../src/viewer/arrows";
import { checkOptions } from "../../src/viewer/format/options";
import { check } from "../../src/viewer/format/record";

describe("disagreementBars", () => {
	const record = check({
		name: "p",
		circular: false,
		bases: "ACGT".repeat(25),
		reads: [{ name: "r1", start: 0, end: 100, strand: 1 }],
		disagreements: [
			{ name: "ins", at: 5, bases: "A", reads: ["r1"] },
			{ name: "41 A>G", start: 40, end: 41, bases: "G", reads: ["r1"] },
			{
				name: "del",
				start: 60,
				end: 63,
				bases: "",
				reads: ["r1"],
				color: "#CC3311",
			},
		],
	});
	const bars = (options: object) =>
		disagreementBars(record, checkOptions(options, record));

	test("gives each disagreement over a span a bar with no heads, in its colour or grey", () => {
		expect(bars({})).toMatchObject([
			{
				feature: {
					name: "41 A>G",
					strand: 0,
					segments: [{ start: 40, end: 41 }],
				},
				label: { kind: "disagreements", name: "41 A>G", color: "#bbbbbb" },
				segments: [{ start: 40, end: 41, color: "#bbbbbb" }],
			},
			{
				feature: { name: "del", strand: 0 },
				segments: [{ start: 60, end: 63, color: "#cc3311" }],
			},
		]);
	});

	test("dims a bar the highlight leaves unlit, and no feature type turns one off", () => {
		const [unlit, lit] = bars({
			highlight: ["del"],
			types_off: ["", "source"],
		});
		expect(unlit.segments[0].color).toBe("#dddddd");
		expect(lit.segments[0].color).toBe("#cc3311");
	});
});
