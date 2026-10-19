import { describe, expect, test } from "vitest";
import { type FormatError, folded } from "../../src/viewer/format";
import { answersTo, checkOptions } from "../../src/viewer/options";
import { check } from "../../src/viewer/record";

/** A 100 bp record. */
function record(circular: boolean) {
	return check({ name: "p", circular, bases: "ACGT".repeat(25) });
}

/** A cut by `enzyme` at `at`, its site the four bases after. */
function cut(enzyme: string, at: number) {
	return { enzyme, start: at, end: at + 4, at, stagger: 0 };
}

/** A 100 bp record with one of each kind, EcoRI and PstI cutting once and BsaI twice. */
const named = check({
	name: "p",
	circular: false,
	bases: "ACGT".repeat(25),
	features: [
		{ name: "lacZ", type: "CDS", strand: 1, segments: [{ start: 0, end: 9 }] },
	],
	primers: [
		{
			name: "M13 fwd",
			bases: "ACGT",
			sites: [{ start: 0, end: 4, strand: 1 }],
		},
	],
	cuts: [cut("BsaI", 10), cut("EcoRI", 20), cut("BsaI", 30), cut("PstI", 40)],
	insertions: [{ name: "attB1", at: 50, length: 25 }],
});

describe("checkOptions", () => {
	test("fills each option left out with its default", () => {
		expect(checkOptions({}, record(false))).toStrictEqual({
			span: { start: 0, end: 100 },
			map: "line",
			types_off: ["source"],
			kinds_off: [],
			enzymes: [],
			highlight: [],
		});
	});

	test("opens a circular record on the circle, and on the line with a span", () => {
		const circular = record(true);
		expect(checkOptions({}, circular).map).toBe("circle");
		expect(checkOptions({ span: { start: 0, end: 100 } }, circular).map).toBe(
			"circle",
		);
		expect(checkOptions({ span: { start: 0, end: 50 } }, circular).map).toBe(
			"line",
		);
		expect(checkOptions({ span: { start: 10, end: 110 } }, circular).map).toBe(
			"line",
		);
	});

	test("checks its own answer again to itself", () => {
		for (const options of [{}, { span: { start: 90, end: 110 } }]) {
			const checked = checkOptions(options, record(true));
			expect(checkOptions(checked, record(true))).toStrictEqual(checked);
		}
	});

	test("turns on the enzymes that cut the record once, in the record's order", () => {
		expect(checkOptions({}, named).enzymes).toEqual(["EcoRI", "PstI"]);
	});

	test("keeps each option given, with a type the record lacks", () => {
		const given = {
			span: { start: 90, end: 110 },
			map: "line",
			types_off: ["telomere"],
			kinds_off: [],
			enzymes: [],
			highlight: [],
		};
		expect(checkOptions(given, record(true))).toStrictEqual(given);
	});

	test("keeps an enzyme that does not cut, and a highlight in any case", () => {
		const given = {
			kinds_off: ["cuts", "primers"],
			enzymes: ["BsaI", "NotI"],
			highlight: ["LACZ", "m13 FWD", "attB1", "ecori"],
		};
		expect(checkOptions(given, named)).toMatchObject(given);
	});

	test.each<[string, unknown, string[]]>([
		[
			"a span past the record's end",
			{ span: { start: 10, end: 120 } },
			["options.span.end: must be at most the record's length, 100"],
		],
		[
			"a map it does not have",
			{ map: "plasmid" },
			['options.map: must be "circle" or "line"'],
		],
		[
			"the circle of a linear record",
			{ map: "circle", span: { start: 0, end: 100 } },
			['options.map: must be "line" on a linear record'],
		],
		[
			"types_off that is not a list",
			{ types_off: "source" },
			["options.types_off: must be a list"],
		],
		[
			"types_off holding a value that is not text",
			{ types_off: ["source", 7] },
			["options.types_off[1]: must be text"],
		],
		[
			"options it does not have, each named",
			{ bogus: 1, typesOff: [] },
			["options.bogus: unknown key", "options.typesOff: unknown key"],
		],
		["options that are not an object", null, ["options: must be an object"]],
		["options that are a list", [1], ["options: must be an object"]],
		[
			"a kind the format does not have",
			{ kinds_off: ["cut_sites"] },
			[
				'options.kinds_off[0]: must be "features", "primers", "cuts" or "insertions"',
			],
		],
		[
			"a highlight that names nothing in the record",
			{ highlight: ["lacZ", "SacI", "bogus"] },
			[
				"options.highlight[1]: names nothing in the record",
				"options.highlight[2]: names nothing in the record",
			],
		],
	])("rejects %s", (_, input, expected) => {
		expect(problems(input)).toEqual(expected);
	});

	test("rejects the circle of a span short of a whole circular record", () => {
		expect(
			problems({ map: "circle", span: { start: 10, end: 110 } }, record(true)),
		).toEqual([
			'options.map: must be "line" when span is not the whole record',
		]);
	});
});

describe("answersTo", () => {
	test("gives each name of the record whatever its case, an enzyme only with a cut", () => {
		expect([...answersTo(named)].sort()).toEqual([
			"attb1",
			"bsai",
			"ecori",
			"lacz",
			"m13 fwd",
			"psti",
		]);
		expect(answersTo(named).has(folded("M13 FWD"))).toBe(true);
	});
});

/** The lines of the error checking `input` against `against` throws, or none. */
function problems(input: unknown, against = named): string[] {
	try {
		checkOptions(input, against);
		return [];
	} catch (error) {
		return (error as FormatError).message.split("\n");
	}
}
