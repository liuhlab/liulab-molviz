import { describe, expect, test } from "vitest";
import type { FormatError } from "../../src/viewer/format";
import { checkPlate, rowLabel, wellAt, wellName } from "../../src/viewer/plate";

const good = {
	title: "picked 1",
	rows: 16,
	columns: 24,
	wells: {
		A1: "quarter 1",
		A3: "quarter 1",
		C1: "quarter 2",
		P24: "quarter 4",
	},
};

describe("checkPlate", () => {
	test("returns a good plate as it is given", () => {
		expect(checkPlate(good)).toStrictEqual(good);
	});

	test.each<[string, object]>([
		["with no title", { rows: 8, columns: 12, wells: { H12: "water" } }],
		["with no wells", { title: "lysate 1", rows: 32, columns: 48 }],
		["with an empty title", { title: "", rows: 8, columns: 12 }],
		["of 1 row by 1 column", { rows: 1, columns: 1, wells: { A1: "tube" } }],
		["with rows past Z", { rows: 27, columns: 1, wells: { AA1: "last" } }],
		["with no well filled", { rows: 8, columns: 12, wells: {} }],
	])("takes a plate %s", (_, plate) => {
		expect(checkPlate(plate)).toStrictEqual(plate);
	});

	test.each<[string, unknown, string[]]>([
		["a plate that is not an object", null, ["plate: must be an object"]],
		[
			"a plate with no rows and no columns",
			{},
			["rows: missing", "columns: missing"],
		],
		[
			"rows and columns of 0, part of one, or not a number",
			{ rows: 0, columns: 1.5 },
			["rows: must be 1 or more", "columns: must be an integer"],
		],
		[
			"columns written as text",
			{ rows: 8, columns: "12" },
			["columns: must be a number"],
		],
		[
			"a title that is not text",
			{ ...good, title: 7 },
			["title: must be text"],
		],
		[
			"wells that are not an object",
			{ ...good, wells: "quarter 1" },
			["wells: must be an object"],
		],
		[
			"a well whose contents are empty or not text",
			{ ...good, wells: { A1: "", A2: ["forward 1"] } },
			["wells.A1: must not be empty", "wells.A2: must be text"],
		],
		[
			"a well past the last row or the last column",
			{ ...good, wells: { Q1: "x", A25: "x", P24: "x" } },
			[
				"wells.Q1: not on the plate, which runs A1 to P24",
				"wells.A25: not on the plate, which runs A1 to P24",
			],
		],
		[
			"a name that is not a well's",
			{ ...good, wells: { A01: "x", b3: "x", reservoir: "x" } },
			[
				"wells.A01: not a well name, such as B3",
				"wells.b3: not a well name, such as B3",
				"wells.reservoir: not a well name, such as B3",
			],
		],
		[
			"a key the format does not have, __proto__ included",
			JSON.parse(
				'{"rows": 1, "columns": 1, "__proto__": 1, "wells": {"__proto__": "x"}}',
			),
			[
				"wells.__proto__: not a well name, such as B3",
				"__proto__: unknown key",
			],
		],
		[
			"a well name with rows or columns broken",
			{ rows: 0, columns: 12, wells: { Q1: "x", A01: "x" } },
			["rows: must be 1 or more", "wells.A01: not a well name, such as B3"],
		],
		[
			"a plate in mbio's own keys",
			{ name: "picked 1", wells: 384, labels: { A1: "quarter 1" } },
			[
				"rows: missing",
				"columns: missing",
				"wells: must be an object",
				"name: unknown key",
				"labels: unknown key",
			],
		],
	])("rejects %s", (_, input, expected) => {
		expect(problems(input)).toEqual(expected);
	});
});

/** The lines of the error checking `input` throws, or none. */
function problems(input: unknown): string[] {
	try {
		checkPlate(input);
		return [];
	} catch (error) {
		return (error as FormatError).message.split("\n");
	}
}

describe("well names", () => {
	test.each<[string, number, number]>([
		["A1", 0, 0],
		["B3", 1, 2],
		["Z12", 25, 11],
		["AA1", 26, 0],
		["AF48", 31, 47],
		["ZZ1", 701, 0],
		["AAA1", 702, 0],
	])("%s is row %i and column %i, counted from 0", (name, row, column) => {
		expect(wellAt(name)).toStrictEqual({ row, column });
		expect(wellName(row, column)).toBe(name);
	});

	test.each(["a1", "A01", "A0", "1A", "A", "B 3", "reservoir", ""])(
		"%j names no well",
		(name) => {
			expect(wellAt(name)).toBeUndefined();
		},
	);

	test("a row's letters run A to Z, then AA on", () => {
		expect([0, 25, 26, 51, 52].map(rowLabel)).toEqual([
			"A",
			"Z",
			"AA",
			"AZ",
			"BA",
		]);
	});
});
