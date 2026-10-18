import { describe, expect, test } from "vitest";
import type { FormatError } from "../../src/viewer/format";
import { checkOptions } from "../../src/viewer/options";
import { check } from "../../src/viewer/record";

/** A 100 bp record. */
function record(circular: boolean) {
	return check({ name: "p", circular, bases: "ACGT".repeat(25) });
}

describe("checkOptions", () => {
	test("fills each option left out with its default", () => {
		expect(checkOptions({}, record(false))).toStrictEqual({
			span: { start: 0, end: 100 },
			map: "line",
			types_off: ["source"],
		});
	});

	test("keeps each option given, with a type the record lacks", () => {
		const given = {
			span: { start: 90, end: 110 },
			map: "line",
			types_off: ["telomere"],
		};
		expect(checkOptions(given, record(true))).toStrictEqual(given);
	});

	test.each<[string, unknown, string[]]>([
		[
			"a span past the record's end",
			{ span: { start: 10, end: 120 } },
			["options.span.end: must be at most the record's length, 100"],
		],
		[
			"a map other than the line",
			{ map: "circle" },
			['options.map: must be "line"'],
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
	])("rejects %s", (_, input, expected) => {
		expect(problems(input)).toEqual(expected);
	});
});

/** The lines of the error checking `input` against a linear record throws, or none. */
function problems(input: unknown): string[] {
	try {
		checkOptions(input, record(false));
		return [];
	} catch (error) {
		return (error as FormatError).message.split("\n");
	}
}
