import { describe, expect, test } from "vitest";
import { checkGel } from "../../src/viewer/gel";
import type { FormatError } from "../../src/viewer/record";

const good = {
	title: "PCR products",
	ladder: { name: "NEB 100 bp DNA Ladder (N3231)", bands: [100, 200, 300] },
	lanes: [
		{ name: "GFP", bands: [741] },
		{ name: "empty vector", bands: [] },
	],
};

describe("checkGel", () => {
	test("returns a good gel as it is given", () => {
		expect(checkGel(good)).toStrictEqual(good);
	});

	test.each<[string, object]>([
		["with no title", { ladder: good.ladder, lanes: good.lanes }],
		["with no lanes", { ...good, lanes: [] }],
		[
			"with an empty title and empty names",
			{
				title: "",
				ladder: { name: "", bands: [100] },
				lanes: [{ name: "", bands: [] }],
			},
		],
	])("takes a gel %s", (_, gel) => {
		expect(checkGel(gel)).toStrictEqual(gel);
	});

	test.each<[string, unknown, string[]]>([
		["a gel that is not an object", null, ["gel: must be an object"]],
		[
			"a gel with no ladder and no lanes",
			{},
			["ladder: missing", "lanes: missing"],
		],
		[
			"a title that is not text",
			{ ...good, title: 7 },
			["title: must be text"],
		],
		[
			"lanes that are not a list",
			{ ...good, lanes: good.lanes[0] },
			["lanes: must be a list"],
		],
		[
			"a lane whose bands are left out",
			{ ...good, lanes: [{ name: "GFP" }] },
			["lanes[0].bands: missing"],
		],
		[
			"keys the format does not have, at every level",
			{
				...good,
				colour: "red",
				ladder: { ...good.ladder, marker: true },
				lanes: [{ name: "GFP", bands: [741], label: "GFP" }],
			},
			[
				"ladder.marker: unknown key",
				"lanes[0].label: unknown key",
				"colour: unknown key",
			],
		],
		[
			"a gel in mbio's own keys",
			{
				ladder: { name: "L", bands_bp: [100] },
				lanes: [{ label: "GFP", bands_bp: [741] }],
			},
			[
				"ladder.bands: missing",
				"ladder.bands_bp: unknown key",
				"lanes[0].name: missing",
				"lanes[0].bands: missing",
				"lanes[0].label: unknown key",
				"lanes[0].bands_bp: unknown key",
			],
		],
		[
			"a ladder with no band",
			{ ...good, ladder: { name: "none", bands: [] } },
			["ladder.bands: must hold at least one band"],
		],
		[
			"a band of 0 bp, part of a bp, or not a number",
			{ ...good, ladder: { name: "L", bands: [0, 1.5, "100"] } },
			[
				"ladder.bands[0]: must be 1 or more",
				"ladder.bands[1]: must be an integer",
				"ladder.bands[2]: must be a number",
			],
		],
		[
			"a lane's band below 1 bp",
			{ ...good, lanes: [{ name: "GFP", bands: [741, -741] }] },
			["lanes[0].bands[1]: must be 1 or more"],
		],
	])("rejects %s", (_, input, expected) => {
		expect(problems(input)).toEqual(expected);
	});
});

/** The lines of the error checking `input` throws, or none. */
function problems(input: unknown): string[] {
	try {
		checkGel(input);
		return [];
	} catch (error) {
		return (error as FormatError).message.split("\n");
	}
}
