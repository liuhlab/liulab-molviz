import { describe, expect, test } from "vitest";
import { layoutCircle } from "../../src/viewer/circle";
import {
	angleOf,
	circleBase,
	circleShading,
	lineBase,
	lineShading,
	lineX,
	pointAt,
	rowBase,
	rowHolding,
	rowShading,
	rowX,
} from "../../src/viewer/geometry";
import { layoutLine } from "../../src/viewer/line";
import { checkOptions } from "../../src/viewer/options";
import { check, recordBounds } from "../../src/viewer/record";
import type { Shape } from "../../src/viewer/scene";
import { layoutSequence } from "../../src/viewer/sequence";
import insertionsFile from "../records/both-strands-and-insertions.json";
import colourTestFile from "../records/colour-test.json";
import primerTestFile from "../records/primer-test.json";
import puc19File from "../records/puc19-gfp-product.json";

/** A circular record of 2686 bases. */
const colourTest = check(colourTestFile);

/** The span the test records' README names for drawing `colour-test` across its origin. */
const ACROSS = { span: { start: 2600, end: 2750 } };

type Line = Extract<Shape, { shape: "line" }>;
type Polygon = Extract<Shape, { shape: "polygon" }>;
type Text = Extract<Shape, { shape: "text" }>;
type Path = Extract<Shape, { shape: "path" }>;

/** The shading's colour and its edges'. */
const SHADE = "#bbddf5";
const EDGE = "#0077bb";

/** A shaded box from `left` to `right` and `top` to `bottom`. */
function shade(left: number, right: number, top: number, bottom: number) {
	return expect.objectContaining({
		shape: "rect",
		x: left,
		y: top,
		width: right - left,
		height: bottom - top,
		fill: SHADE,
	});
}

/** A point to nine decimals, so that two computed alike compare equal. */
function round(x: number, y: number): number[] {
	return [x, y].map((v) => Math.round(v * 1e9) / 1e9 + 0);
}

/** An edge at `x` from `top` to `bottom`. */
function edge(x: number, top: number, bottom: number) {
	return {
		shape: "line",
		x1: x,
		y1: top,
		x2: x,
		y2: bottom,
		stroke: EDGE,
		strokeWidth: 1,
	};
}

describe("the line", () => {
	const options = checkOptions(ACROSS, colourTest);

	test.each([720, 1440, 5000])(
		"finds each base under its middle, across the origin, %d points long",
		(width) => {
			const { geometry } = layoutLine(colourTest, options, width);
			// Bases 2600 and 2685 before the origin, 0, 1 and 63 after it, counted as the span counts.
			for (const position of [2600, 2685, 2686, 2687, 2749]) {
				expect(lineBase(geometry, lineX(geometry, position + 0.5))).toBe(
					position,
				);
			}
		},
	);

	test("puts the origin where the ruler draws its tick, and the span's ends at the line's", () => {
		const scene = layoutLine(colourTest, options, 1440);
		const origin = scene.shapes.find(
			(s): s is Line => s.shape === "line" && s.strokeWidth === 2.4,
		);
		expect(lineX(scene.geometry, 2686)).toBeCloseTo(origin?.x1 ?? NaN, 9);
		expect(lineX(scene.geometry, 2600)).toBe(0);
		expect(lineX(scene.geometry, 2750)).toBe(1440);
	});

	test("takes a point past either end to the span's nearest base", () => {
		const { geometry } = layoutLine(colourTest, options);
		expect(lineBase(geometry, -50)).toBe(2600);
		expect(lineBase(geometry, 720)).toBe(2749);
		expect(lineBase(geometry, 2000)).toBe(2749);
	});
});

describe("the line's marks", () => {
	test.each([
		["primer-test", primerTestFile, {}],
		["both-strands-and-insertions", insertionsFile, { map: "line" }],
	])(
		"lie between its top and bottom, the title under them: %s",
		(_, file, given) => {
			const record = check(file);
			const scene = layoutLine(record, checkOptions(given, record));
			const { top, bottom } = scene.geometry;
			const ys = [
				...scene.shapes
					.filter((s): s is Polygon => s.shape === "polygon")
					.flatMap((s) => s.points.map(([, y]) => y)),
				...scene.shapes
					.filter((s): s is Line => s.shape === "line" && s.strokeWidth === 2)
					.flatMap((s) => [s.y1, s.y2]),
			];
			expect(ys.length).toBeGreaterThan(2);
			expect(Math.min(...ys)).toBeCloseTo(top, 9);
			expect(Math.max(...ys)).toBeLessThanOrEqual(bottom);
			const title = scene.shapes.find(
				(s): s is Text => s.shape === "text" && s.size === 13.5,
			);
			expect(title?.y).toBeGreaterThan(bottom);
		},
	);
});

describe("the circle", () => {
	const options = checkOptions({}, colourTest);

	test.each([
		[0, 1],
		[90, 0.5],
		[200, 3],
		[-45, 1.5],
	])(
		"finds each base under its middle at any radius, turned %d degrees at %d times",
		(rotation, zoom) => {
			const { geometry } = layoutCircle(colourTest, options, rotation, zoom);
			for (const base of [0, 1, 1343, 2684, 2685]) {
				const angle = angleOf(base + 0.5, geometry);
				for (const radius of [1, geometry.inner, geometry.outer, 1000]) {
					expect(circleBase(geometry, ...pointAt(radius, angle))).toBe(base);
				}
			}
		},
	);

	test("puts the origin where the backbone draws its tick, the first base clockwise of it", () => {
		const scene = layoutCircle(colourTest, options, 200, 2);
		const tick = scene.shapes.find(
			(s): s is Line => s.shape === "line" && s.strokeWidth === 2.4,
		) as Line;
		const angle = Math.atan2(tick.x1, -tick.y1);
		const turn = angleOf(0, scene.geometry) - angle;
		expect(
			Math.abs(turn - 2 * Math.PI * Math.round(turn / (2 * Math.PI))),
		).toBeLessThan(1e-9);
		const [x, y] = [tick.x1, tick.y1];
		const by = (a: number) =>
			[
				x * Math.cos(a) - y * Math.sin(a),
				x * Math.sin(a) + y * Math.cos(a),
			] as const;
		expect(circleBase(scene.geometry, ...by(1e-4))).toBe(0);
		expect(circleBase(scene.geometry, ...by(-1e-4))).toBe(2685);
	});

	test.each([
		["puc19-gfp-product", puc19File],
		["both-strands-and-insertions", insertionsFile],
	])("sets every mark between its inner and outer radii: %s", (_, file) => {
		const record = check(file);
		const { shapes, geometry } = layoutCircle(record, checkOptions({}, record));
		const radii = [
			...shapes
				.filter((s): s is Path => s.shape === "path" && s.fill !== "none")
				.flatMap((s) =>
					s.commands.flatMap((c) =>
						c[0] === "Z"
							? []
							: [Math.hypot(c.at(-2) as number, c.at(-1) as number)],
					),
				),
			...shapes
				.filter((s): s is Line => s.shape === "line" && s.strokeWidth === 2)
				.flatMap((s) => [Math.hypot(s.x1, s.y1), Math.hypot(s.x2, s.y2)]),
		];
		expect(radii.length).toBeGreaterThan(2);
		expect(Math.min(...radii)).toBeGreaterThanOrEqual(geometry.inner - 1e-9);
		expect(Math.max(...radii)).toBeCloseTo(geometry.outer, 9);
		expect(geometry.inner).toBeLessThan(geometry.radius);
	});
});

describe("the sequence view's rows", () => {
	const sequence = layoutSequence(
		colourTest,
		checkOptions({ ...ACROSS, sequence_view: true }, colourTest),
	);
	const { rows } = sequence;
	const middle = ([top, bottom]: readonly [number, number]) =>
		(top + bottom) / 2;

	test("hold the span's bases, 60 a row, and lie where the strands and rail are drawn", () => {
		expect(rows.map(({ start, end }) => [start, end])).toEqual([
			[2600, 2660],
			[2660, 2720],
			[2720, 2750],
		]);
		const strands = sequence.shapes
			.filter((s): s is Text => s.shape === "text" && s.face === "mono")
			.sort((a, b) => a.y - b.y);
		const rails = sequence.shapes
			.filter((s): s is Line => s.shape === "line" && s.strokeWidth === 1.6)
			.sort((a, b) => a.y1 - b.y1);
		for (const [i, row] of rows.entries()) {
			const [top, bottom] = [strands[2 * i], strands[2 * i + 1]];
			expect([top.x, top.cell, bottom.x, bottom.cell]).toEqual([0, 11, 0, 11]);
			expect(top.y).toBeGreaterThan(row.strands.top[0]);
			expect(top.y).toBeLessThan(row.strands.top[1]);
			expect(bottom.y).toBeGreaterThan(row.strands.bottom?.[0] ?? NaN);
			expect(bottom.y).toBeLessThan(row.strands.bottom?.[1] ?? NaN);
			expect(rails[i].y1).toBe(row.strands.rail);
			expect(rowX(row, row.end)).toBe(rails[i].x2);
		}
	});

	test("find each base under its middle on either strand, across the origin", () => {
		for (const position of [2600, 2659, 2660, 2685, 2686, 2749]) {
			const row = rowHolding(rows, position);
			if (!row) throw new Error(`no row holds ${position}`);
			const x = rowX(row, position + 0.5);
			const { top, rail, bottom } = row.strands;
			for (const y of [middle(top), rail, middle(bottom ?? [NaN, NaN])]) {
				expect(rowBase(rows, x, y)).toBe(position);
			}
		}
		expect(rowHolding(rows, 2599)).toBeNull();
		expect(rowHolding(rows, 2750)).toBeNull();
	});

	test("find no base off the strands, or else the nearest", () => {
		const [first, second] = rows;
		const between = (first.strands.bottom?.[1] ?? NaN) + 1;
		const off: [number, number, number][] = [
			[5, first.strands.top[0] - 1, 2600],
			[5, -1000, 2600],
			[5, between, 2600],
			[-3, middle(second.strands.top), 2660],
			[rowX(second, second.end) + 3, middle(second.strands.top), 2719],
			[rowX(rows[2], 2755), 1e6, 2749],
		];
		for (const [x, y, nearest] of off) {
			expect(rowBase(rows, x, y)).toBeNull();
			expect(rowBase(rows, x, y, { near: true })).toBe(nearest);
		}
	});

	test("end at the rail with the bottom strand hidden or left out", () => {
		const [row] = rows;
		const x = rowX(row, 2610.5);
		const under = middle(row.strands.bottom ?? [NaN, NaN]);
		expect(rowBase(rows, x, under, { bottom: false })).toBeNull();
		expect(rowBase(rows, x, row.strands.rail, { bottom: false })).toBe(2610);
		const one = layoutSequence(
			colourTest,
			checkOptions(
				{ ...ACROSS, sequence_view: true, bottom_strand: false },
				colourTest,
			),
		).rows[0];
		expect(one.strands.bottom).toBeNull();
		expect(rowBase([one], x, one.strands.rail)).toBe(2610);
		expect(rowBase([one], x, one.strands.rail + 1)).toBeNull();
	});
});

describe("a selection", () => {
	const bounds = recordBounds(colourTest);

	test("shades the line from its start to its end, edged at each end the span shows", () => {
		const width = 1500;
		const { start, end } = ACROSS.span;
		const x = (base: number) => ((base - start) * width) / (end - start);
		const { geometry } = layoutLine(
			colourTest,
			checkOptions(ACROSS, colourTest),
			width,
		);
		const { top, bottom } = geometry;
		expect(lineShading(geometry, bounds, { start: 2680, end: 2696 })).toEqual([
			shade(x(2680), x(2696), top, bottom),
			edge(x(2680), top, bottom),
			edge(x(2696), top, bottom),
		]);
		expect(lineShading(geometry, bounds, { start: 2550, end: 2610 })).toEqual([
			shade(0, x(2610), top, bottom),
			edge(x(2610), top, bottom),
		]);
	});

	test("shades a whole circle's line either side of the origin", () => {
		const { geometry } = layoutLine(
			colourTest,
			checkOptions({ map: "line" }, colourTest),
			2686,
		);
		const { top, bottom } = geometry;
		expect(lineShading(geometry, bounds, { start: 2680, end: 2696 })).toEqual([
			shade(0, 10, top, bottom),
			edge(10, top, bottom),
			shade(2680, 2686, top, bottom),
			edge(2680, top, bottom),
		]);
	});

	test("shades the circle from its inner to its outer radius, edged at each end", () => {
		const { geometry } = layoutCircle(colourTest, checkOptions({}, colourTest));
		const { inner, outer } = geometry;
		// A quarter turn from the top.
		const [shading, ...edges] = circleShading(geometry, {
			start: 0,
			end: 2686 / 4,
		}) as [Path, Line, Line];
		expect(shading.fill).toBe(SHADE);
		const ends = shading.commands.flatMap((c) =>
			c[0] === "Z" ? [] : [round(c.at(-2) as number, c.at(-1) as number)],
		);
		expect(ends[0]).toEqual(round(0, -outer));
		expect(ends).toContainEqual(round(outer, 0));
		expect(ends).toContainEqual(round(inner, 0));
		expect(ends.at(-1)).toEqual(round(0, -inner));
		expect(
			edges.map((e) => [
				e.stroke,
				e.strokeWidth,
				...round(e.x1, e.y1),
				...round(e.x2, e.y2),
			]),
		).toEqual([
			[EDGE, 1, ...round(0, -inner), ...round(0, -outer)],
			[EDGE, 1, ...round(inner, 0), ...round(outer, 0)],
		]);
	});

	test("shades each row's strands it holds, edged at its start and end", () => {
		const { rows } = layoutSequence(
			colourTest,
			checkOptions({ ...ACROSS, sequence_view: true }, colourTest),
		);
		const [first, second] = rows;
		const [top1, foot1] = [
			first.strands.top[0],
			first.strands.bottom?.[1] ?? NaN,
		];
		const [top2, foot2] = [
			second.strands.top[0],
			second.strands.bottom?.[1] ?? NaN,
		];
		expect(rowShading(rows, bounds, { start: 2650, end: 2675 })).toEqual([
			shade(550, 660, top1, foot1),
			edge(550, top1, foot1),
			shade(0, 165, top2, foot2),
			edge(165, top2, foot2),
		]);
		expect(
			rowShading(rows, bounds, { start: 2680, end: 2696 }, { bottom: false }),
		).toEqual([
			shade(220, 396, top2, second.strands.rail),
			edge(220, top2, second.strands.rail),
			edge(396, top2, second.strands.rail),
		]);
	});
});
