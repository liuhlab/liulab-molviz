import * as v from "valibot";
import { describe, expect, test } from "vitest";
import {
	type Bounds,
	base,
	check,
	FormatError,
	parse,
	point,
	span,
} from "../../src/viewer/record";

const good = { name: "pUC19", circular: true, bases: "GATCcatgRYN" };

describe("check", () => {
	test("returns a good record as it was given", () => {
		expect(check(good)).toEqual(good);
	});

	test("rejects a key the format does not have", () => {
		expect(() => check({ ...good, colour: "red" })).toThrow(
			new FormatError("colour: unknown key"),
		);
	});

	test.each([
		[
			{ ...good, bases: "ACGTX" },
			'bases: has "X" at index 4, which is not an IUPAC nucleotide letter',
		],
		[
			{ ...good, bases: "AC GT" },
			'bases: has " " at index 2, which is not an IUPAC nucleotide letter',
		],
		[{ ...good, bases: "" }, "bases: must hold at least one base"],
		[{ ...good, name: 7 }, "name: must be text"],
		[{ ...good, circular: "yes" }, "circular: must be true or false"],
		[{ name: "pUC19", bases: "ACGT" }, "circular: missing"],
		[null, "record: must be an object"],
	])("rejects %j", (input, message) => {
		expect(() => check(input)).toThrow(new FormatError(message));
	});

	test("names every problem in one error, one per line", () => {
		expect(() =>
			check({ name: 7, circular: true, bases: "", colour: "red" }),
		).toThrow(
			new FormatError(
				"name: must be text\nbases: must hold at least one base\ncolour: unknown key",
			),
		);
	});
});

const circular: Bounds = { length: 2686, circular: true };
const linear: Bounds = { length: 2686, circular: false };

/** The lines of the error `parse` throws, or none. */
function problems(schema: v.GenericSchema, input: unknown): string[] {
	try {
		parse(schema, input);
		return [];
	} catch (error) {
		return (error as FormatError).message.split("\n");
	}
}

describe("span", () => {
	// A stand-in for a kind, so each problem is named by a nested path.
	const kind = (bounds: Bounds) =>
		v.strictObject({ segments: v.array(span(bounds)) });

	test.each<[string, Bounds, unknown, string[]]>([
		[
			"across the origin, on a circular record",
			circular,
			{ start: 2683, end: 2689 },
			[],
		],
		[
			"across the origin, on a linear record",
			linear,
			{ start: 2683, end: 2689 },
			["segments[0].end: must be at most the record's length, 2686"],
		],
		["the whole circular record", circular, { start: 0, end: 2686 }, []],
		["the whole linear record", linear, { start: 0, end: 2686 }, []],
		[
			"more than one turn",
			circular,
			{ start: 100, end: 2787 },
			["segments[0].end: must be at most start + 2686, one turn of the record"],
		],
		[
			"empty",
			circular,
			{ start: 5, end: 5 },
			["segments[0].end: must be greater than start"],
		],
		[
			"starting at the length",
			circular,
			{ start: 2686, end: 2690 },
			["segments[0].start: must be less than the record's length, 2686"],
		],
		[
			"starting below 0",
			linear,
			{ start: -1, end: 3 },
			["segments[0].start: must be 0 or more"],
		],
		[
			"not whole numbers",
			linear,
			{ start: 1.5, end: 3.5 },
			[
				"segments[0].start: must be an integer",
				"segments[0].end: must be an integer",
			],
		],
		[
			"not numbers",
			linear,
			{ start: "1", end: 3 },
			["segments[0].start: must be a number"],
		],
	])("%s", (_, bounds, segment, expected) => {
		expect(problems(kind(bounds), { segments: [segment] })).toEqual(expected);
	});
});

describe("point", () => {
	const kind = (bounds: Bounds) => v.strictObject({ at: point(bounds) });

	test.each<[string, Bounds, number, string[]]>([
		["at the length, on a linear record", linear, 2686, []],
		[
			"at the length, on a circular record",
			circular,
			2686,
			[
				"at: must be less than the record's length, 2686: on a circular record that point is 0",
			],
		],
		["at the origin", circular, 0, []],
		[
			"past the length",
			linear,
			2687,
			["at: must be at most the record's length, 2686"],
		],
		["below 0", linear, -1, ["at: must be 0 or more"]],
		["not a whole number", linear, 4.5, ["at: must be an integer"]],
	])("%s", (_, bounds, at, expected) => {
		expect(problems(kind(bounds), { at })).toEqual(expected);
	});
});

describe("base", () => {
	const kind = (bounds: Bounds) => v.strictObject({ at: base(bounds) });

	test.each<[string, Bounds, number, string[]]>([
		["the last base", circular, 2685, []],
		[
			"at the length",
			linear,
			2686,
			["at: must be less than the record's length, 2686"],
		],
		["below 0", circular, -1, ["at: must be 0 or more"]],
	])("%s", (_, bounds, at, expected) => {
		expect(problems(kind(bounds), { at })).toEqual(expected);
	});
});
