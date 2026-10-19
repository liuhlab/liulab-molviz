import { describe, expect, test } from "vitest";
import { rowPages, stacked } from "../../src/viewer/pages";
import type { Box, Scene, Shape } from "../../src/viewer/scene";

/** A mark filling `box`, standing for what a scene draws there. */
function mark({ x, y, width, height }: Box): Shape {
	return {
		shape: "rect",
		x,
		y,
		width,
		height,
		corner: 0,
		fill: "#000000",
		stroke: "#000000",
		strokeWidth: 0,
	};
}

/** A line across the middle of `box`, which has no box of its own. */
function rule({ x, y, width, height }: Box): Shape {
	const middle = y + height / 2;
	return {
		shape: "line",
		x1: x,
		y1: middle,
		x2: x + width,
		y2: middle,
		stroke: "#000000",
		strokeWidth: 1,
	};
}

describe("stacked", () => {
	const map: Scene = {
		extent: { x: -16, y: -40, width: 752, height: 100 },
		shapes: [mark({ x: 0, y: -24, width: 720, height: 68 })],
	};

	test("sets the second scene under the first, centred, the two extents touching", () => {
		const view = { x: 0, y: 0, width: 468, height: 168 };
		const under = {
			extent: { x: -16, y: -16, width: 500, height: 200 },
			shapes: [mark(view)],
		};
		expect(stacked(map, under)).toEqual({
			extent: { x: -16, y: -40, width: 752, height: 300 },
			shapes: [...map.shapes, mark({ ...view, x: 126, y: 76 })],
		});
	});

	test("widens to the second scene, centring the first over it", () => {
		const view = { x: 0, y: 0, width: 968, height: 168 };
		const under = {
			extent: { x: -16, y: -16, width: 1000, height: 200 },
			shapes: [mark(view)],
		};
		expect(stacked(map, under)).toEqual({
			extent: { x: -140, y: -40, width: 1000, height: 300 },
			shapes: [...map.shapes, mark({ ...view, x: -124, y: 76 })],
		});
	});
});

describe("rowPages", () => {
	// Rows 50 high and 16 apart, the fourth 300 high, in a view 132 wide: a page may run to
	// 132 × √2 ≈ 186.7.
	const rows: Box[] = [0, 66, 132, 198, 514].map((y, i) => ({
		x: 0,
		y,
		width: 100,
		height: i === 3 ? 300 : 50,
	}));
	const view = {
		extent: { x: -16, y: -16, width: 132, height: 596 },
		rows,
		shapes: rows.flatMap((row) => [mark(row), rule(row)]),
	};
	const drawn = (i: number) => [mark(rows[i]), rule(rows[i])];

	test("puts whole rows on pages as wide as the view, each at most √2 times that tall", () => {
		expect(rowPages(view)).toEqual([
			{
				extent: { x: -16, y: -16, width: 132, height: 148 },
				shapes: [...drawn(0), ...drawn(1)],
			},
			{
				extent: { x: -16, y: 116, width: 132, height: 82 },
				shapes: drawn(2),
			},
			{
				extent: { x: -16, y: 182, width: 132, height: 332 },
				shapes: drawn(3),
			},
			{
				extent: { x: -16, y: 498, width: 132, height: 82 },
				shapes: drawn(4),
			},
		]);
	});
});
