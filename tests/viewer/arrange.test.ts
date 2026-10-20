import { describe, expect, test } from "vitest";
import { arrange } from "../../src/viewer/arrange";

/** A map 600 wide at 1×, the view 800 wide with full rows and 700 with half, 20 apart. */
const GAP = 20;
const WIDTHS = { map: 600, full: 800, half: 700 };

describe("arrange", () => {
	test("puts the view beside the map with full rows when both fit at full size", () => {
		expect(arrange(1420, GAP, WIDTHS)).toEqual({
			place: "beside",
			rows: "full",
			scale: 1,
		});
	});

	test("puts the view beside with half rows once full rows no longer fit beside", () => {
		expect(arrange(1419, GAP, WIDTHS)).toEqual({
			place: "beside",
			rows: "half",
			scale: 1,
		});
		expect(arrange(1320, GAP, WIDTHS).place).toBe("beside");
	});

	test("puts the view under the map with full rows once half rows no longer fit beside", () => {
		const under = { place: "under", rows: "full", scale: 1 };
		expect(arrange(1319, GAP, WIDTHS)).toEqual(under);
		expect(arrange(800, GAP, WIDTHS)).toEqual(under);
	});

	test("lays the view under out with half rows once full rows no longer fit the room", () => {
		const under = { place: "under", rows: "half", scale: 1 };
		expect(arrange(799, GAP, WIDTHS)).toEqual(under);
		expect(arrange(700, GAP, WIDTHS)).toEqual(under);
	});

	test("scales the view with half rows down to the room once they no longer fit it", () => {
		expect(arrange(350, GAP, WIDTHS)).toEqual({
			place: "under",
			rows: "half",
			scale: 0.5,
		});
	});

	test("arranges the view under a map wider than the room by the view's own width", () => {
		const wide = { ...WIDTHS, map: 1000 };
		expect(arrange(900, GAP, wide)).toEqual({
			place: "under",
			rows: "full",
			scale: 1,
		});
		expect(arrange(350, GAP, wide)).toEqual({
			place: "under",
			rows: "half",
			scale: 0.5,
		});
	});

	test("keeps the view under with full rows at full size when the room is unknown", () => {
		expect(arrange(0, GAP, WIDTHS)).toEqual({
			place: "under",
			rows: "full",
			scale: 1,
		});
	});
});
