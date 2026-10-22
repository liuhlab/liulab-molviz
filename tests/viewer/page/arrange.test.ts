import { describe, expect, test } from "vitest";
import { arrange } from "../../../src/viewer/page/arrange";
import { CELL } from "../../../src/viewer/sequence/row";

const GAP = 20;
const MAP = 400;
const view = (perRow: number) => 80 + CELL * perRow;
const WIDTHS = { map: MAP, view };

describe("arrange", () => {
	test("lays the view under the map out with the most bases a row fits, in steps of 10", () => {
		const under = (perRow: number) => ({ place: "under", perRow, scale: 1 });
		expect(arrange(view(60) - 1, GAP, WIDTHS)).toEqual(under(50));
		expect(arrange(view(60), GAP, WIDTHS)).toEqual(under(60));
		expect(arrange(view(70) - 1, GAP, WIDTHS)).toEqual(under(60));
		expect(arrange(view(70), GAP, WIDTHS)).toEqual(under(70));
	});

	test("puts the view beside the map once a row of 60 bases fits there, filling the room beside", () => {
		const beside = (perRow: number) => ({ place: "beside", perRow, scale: 1 });
		expect(arrange(MAP + GAP + view(60) - 1, GAP, WIDTHS)).toEqual({
			place: "under",
			perRow: 90,
			scale: 1,
		});
		expect(arrange(MAP + GAP + view(60), GAP, WIDTHS)).toEqual(beside(60));
		expect(arrange(MAP + GAP + view(80), GAP, WIDTHS)).toEqual(beside(80));
		expect(arrange(5000, GAP, WIDTHS)).toEqual(beside(100));
	});

	test("holds at most 100 bases a row, however wide the room", () => {
		const wide = { ...WIDTHS, map: 6000 };
		expect(arrange(5000, GAP, wide)).toEqual({
			place: "under",
			perRow: 100,
			scale: 1,
		});
	});

	test("holds at least 20 bases a row, scaled down to a room narrower than such a row", () => {
		const under = (scale: number) => ({ place: "under", perRow: 20, scale });
		expect(arrange(view(30) - 1, GAP, WIDTHS)).toEqual(under(1));
		expect(arrange(view(20), GAP, WIDTHS)).toEqual(under(1));
		expect(arrange(view(20) / 2, GAP, WIDTHS)).toEqual(under(0.5));
	});

	test("uses a given row length as it is, beside the map once it fits there, scaled down to a room it does not fit", () => {
		const given = (place: string, perRow: number, scale = 1) => ({
			place,
			perRow,
			scale,
		});
		const beside61 = MAP + GAP + view(61);
		expect(arrange(beside61, GAP, WIDTHS, 61)).toEqual(given("beside", 61));
		expect(arrange(5000, GAP, WIDTHS, 61)).toEqual(given("beside", 61));
		expect(arrange(beside61 - 1, GAP, WIDTHS, 61)).toEqual(given("under", 61));
		expect(arrange(view(61), GAP, WIDTHS, 61)).toEqual(given("under", 61));
		expect(arrange(view(61) / 2, GAP, WIDTHS, 61)).toEqual(
			given("under", 61, 0.5),
		);
		expect(arrange(MAP + GAP + view(5), GAP, WIDTHS, 5)).toEqual(
			given("beside", 5),
		);
		expect(arrange(view(150), GAP, WIDTHS, 150)).toEqual(given("under", 150));
	});

	test("keeps the view under with 60 bases a row, or the given length, at full size when the room is unknown", () => {
		expect(arrange(0, GAP, WIDTHS)).toEqual({
			place: "under",
			perRow: 60,
			scale: 1,
		});
		expect(arrange(0, GAP, WIDTHS, 61)).toEqual({
			place: "under",
			perRow: 61,
			scale: 1,
		});
	});
});
