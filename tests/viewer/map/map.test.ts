import { describe, expect, test } from "vitest";
import { checkOptions } from "../../../src/viewer/format/options";
import { check } from "../../../src/viewer/format/record";
import { layoutCircle } from "../../../src/viewer/map/circle";
import { layoutLine } from "../../../src/viewer/map/line";
import { angleOf, lineX } from "../../../src/viewer/map/map";
import type { Shape } from "../../../src/viewer/scene";
import colourTestFile from "../../records/colour-test.json";

/** A circular record of 2686 bases. */
const colourTest = check(colourTestFile);

type Line = Extract<Shape, { shape: "line" }>;

/** The origin's tick, the only line drawn this thick. */
function originTick(shapes: readonly Shape[]): Line {
	return shapes.find(
		(s): s is Line => s.shape === "line" && s.strokeWidth === 2.4,
	) as Line;
}

describe("the line", () => {
	test("puts the origin where the ruler draws its tick, and the span's ends at the line's", () => {
		const options = checkOptions(
			{ span: { start: 2600, end: 2750 } },
			colourTest,
		);
		const scene = layoutLine(colourTest, options, 1440);
		const origin = originTick(scene.shapes);
		expect(lineX(scene.geometry, 2686)).toBeCloseTo(origin.x1, 9);
		expect(lineX(scene.geometry, 2600)).toBe(0);
		expect(lineX(scene.geometry, 2750)).toBe(1440);
	});
});

describe("the circle", () => {
	test("puts the origin where the backbone draws its tick", () => {
		const scene = layoutCircle(
			colourTest,
			checkOptions({}, colourTest),
			200,
			2,
		);
		const tick = originTick(scene.shapes);
		const turn = angleOf(0, scene.geometry) - Math.atan2(tick.x1, -tick.y1);
		expect(
			Math.abs(turn - 2 * Math.PI * Math.round(turn / (2 * Math.PI))),
		).toBeLessThan(1e-9);
	});
});
