import { describe, expect, test } from "vitest";
import { bounds } from "../../src/viewer/bounds";
import type { Box } from "../../src/viewer/scene";

function near(box: Box | null, expected: Box): void {
	expect(box).not.toBeNull();
	for (const key of ["x", "y", "width", "height"] as const)
		expect(box?.[key]).toBeCloseTo(expected[key], 9);
}

describe("bounds", () => {
	test("holds a path's arcs where they bulge past their ends", () => {
		const paint = { fill: "none", stroke: "#252525", strokeWidth: 2.6 };
		const circle = bounds({
			shape: "path",
			commands: [
				["M", 0, -220],
				["A", 220, 0, 1, 0, 220],
				["A", 220, 0, 1, 0, -220],
				["Z"],
			],
			...paint,
		});
		near(circle, { x: -220, y: -220, width: 440, height: 440 });
		// Three quarters of a turn clockwise from the left of its centre, (220, -220), to its foot.
		const large = bounds({
			shape: "path",
			commands: [
				["M", 0, -220],
				["A", 220, 1, 1, 220, 0],
			],
			...paint,
		});
		near(large, { x: 0, y: -440, width: 440, height: 440 });
	});
});
