/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { checkOptions } from "../../../src/viewer/format/options";
import { check } from "../../../src/viewer/format/record";
import type { Box, Shape } from "../../../src/viewer/scene";
import {
	layoutSequence,
	type SequenceScene,
} from "../../../src/viewer/sequence/view";
import { height, measure } from "../../../src/viewer/text/text";
import { prepare } from "../../../src/viewer/views";

/** The Sanger trace's records, read forward and reversed. */
const TRACES = import.meta.glob("../../records/trace-3730*.json", {
	eager: true,
	import: "default",
});

/** 300 bases on a linear record, unless `record` says otherwise. */
const BASES = "ACGT".repeat(75);

const CELL = 11;
const A = "#228833";

function lay(record: object = {}, options: object = {}): SequenceScene {
	const checked = check({
		name: "test",
		circular: false,
		bases: BASES,
		...record,
	});
	return layoutSequence(
		checked,
		checkOptions({ sequence_view: true, ...options }, checked),
	);
}

/**
 * A track named `name` whose peaks lie 10 samples apart over `bases`, curve A 1 at each peak and
 * 0 between, the other curves 0.
 */
function track(name: string, bases: readonly number[]) {
	const peaks = bases.map((base, i) => [10 * (i + 1), base]);
	const zero = Array<number>(10 * (bases.length + 2)).fill(0);
	const spikes = [...zero];
	for (const [sample] of peaks) spikes[sample] = 1;
	return { name, curves: { A: spikes, C: zero, G: zero, T: zero }, peaks };
}

/** The whole numbers from `start` up to `end`, or down to it when `step` is negative. */
function range(start: number, end: number, step = 1): number[] {
	const out: number[] = [];
	for (let n = start; step > 0 ? n < end : n > end; n += step) out.push(n);
	return out;
}

type Path = Extract<Shape, { shape: "path" }>;
type Line = Extract<Shape, { shape: "line" }>;
type Text = Extract<Shape, { shape: "text" }>;

/** The sans texts over `row`'s first strip, left to right. */
function key(scene: SequenceScene, row: Box): Text[] {
	const [foot] = feet(scene, row);
	return scene.shapes
		.filter(
			(s): s is Text =>
				s.shape === "text" &&
				s.face === "sans" &&
				s.y < foot &&
				s.y > foot - 60,
		)
		.sort((a, b) => a.x - b.x);
}

/** The heights of the lines along the strips' feet in `row`, top to bottom. */
function feet(scene: SequenceScene, row: Box): number[] {
	return scene.shapes
		.filter(
			(s): s is Line =>
				s.shape === "line" &&
				s.strokeWidth === 0.5 &&
				s.y1 >= row.y &&
				s.y1 <= row.y + row.height,
		)
		.map((s) => s.y1)
		.sort((a, b) => a - b);
}

/** The paths stroked `stroke` in `row`, each as its points in the order drawn. */
function curves(
	scene: SequenceScene,
	row: Box,
	stroke = A,
): (readonly [number, number])[][] {
	return scene.shapes
		.filter((s): s is Path => s.shape === "path" && s.stroke === stroke)
		.map((s) =>
			s.commands.map((c) => {
				if (c[0] !== "M" && c[0] !== "L") throw new Error("not a line");
				return [c[1], c[2]] as const;
			}),
		)
		.filter((points) =>
			points.every(([, y]) => y >= row.y && y <= row.y + row.height),
		);
}

describe("a track", () => {
	test("lays each peak over the middle of its base, in the rows its peaks reach", () => {
		const forward = track("forward", range(50, 75));
		const backward = track("backward", range(130, 110, -1));
		const broken = track("broken", [200, 201, 205, 206]);
		for (const one of [forward, backward, broken]) {
			const scene = lay({ tracks: [one] });
			const reached = scene.rows.map((row, i) => {
				const points = curves(scene, row).flat();
				if (points.length === 0) return null;
				const top = Math.min(...points.map(([, y]) => y));
				const peaks = points.filter(([, y]) => y === top).map(([x]) => x);
				return [i, peaks.sort((a, b) => a - b)];
			});
			const expected = new Map<number, number[]>();
			for (const [, base] of one.peaks) {
				const row = Math.floor(base / 60);
				const xs = expected.get(row) ?? [];
				expected.set(row, [...xs, (base - row * 60 + 0.5) * CELL]);
			}
			expect(reached.filter((r) => r !== null)).toEqual(
				[...expected]
					.sort(([a], [b]) => a - b)
					.map(([row, xs]) => [
						row,
						xs.sort((a, b) => a - b).map((x) => expect.closeTo(x, 9)),
					]),
			);
		}
	});

	test("places the samples between peaks evenly, half a base past each end, broken where bases part", () => {
		const reach = (one: object, row: number) => {
			const scene = lay({ tracks: [one] });
			return curves(scene, scene.rows[row]).map((points) => {
				const xs = points.map(([x]) => x / CELL);
				const steps = new Set(
					xs.slice(1).map((x, i) => (x - xs[i]).toFixed(9)),
				);
				return [xs[0], xs.at(-1), xs.length, [...steps]].map((n) =>
					typeof n === "number" ? Number(n.toFixed(9)) : n,
				);
			});
		};
		const forward = track("forward", range(50, 75));
		expect(reach(forward, 0)).toEqual([[50, 59.9, 100, ["0.100000000"]]]);
		expect(reach(forward, 1)).toEqual([[0, 14.9, 150, ["0.100000000"]]]);
		const broken = track("broken", [200, 201, 205, 206]);
		expect(reach(broken, 3)).toEqual([
			[20, 21.9, 20, ["0.100000000"]],
			[25, 26.9, 20, ["0.100000000"]],
		]);
		const backward = track("backward", range(130, 110, -1));
		expect(reach(backward, 1)).toEqual([[59.9, 51.1, 89, ["-0.100000000"]]]);
	});

	test("runs on across the origin of a circular record", () => {
		const across = track("across", [...range(290, 300), ...range(0, 10)]);
		const scene = lay(
			{ circular: true, tracks: [across] },
			{ span: { start: 280, end: 320 } },
		);
		const [row] = scene.rows;
		const [points, ...others] = curves(scene, row);
		expect(others).toEqual([]);
		expect(points.length).toBe(200);
		expect(points[0][0]).toBeCloseTo(10 * CELL, 9);
		expect(points.at(-1)?.[0]).toBeCloseTo(29.9 * CELL, 9);
	});

	test("scales each row's curves so its highest value reaches the strip's top, 0 and less its foot", () => {
		const scaled = track("scaled", range(50, 75));
		const values = scaled.curves.A.map((value, sample): number =>
			value === 0 ? 0 : sample <= 50 ? 2 : sample <= 100 ? 4 : 8,
		);
		values[15] = -5;
		const scene = lay({
			tracks: [{ ...scaled, curves: { ...scaled.curves, A: values } }],
		});
		for (const row of scene.rows.slice(0, 2)) {
			const [foot] = feet(scene, row);
			const ys = curves(scene, row).flatMap((points) =>
				points.map(([, y]) => y),
			);
			expect(Math.min(...ys)).toBeCloseTo(foot - 40, 9);
			expect(Math.max(...ys)).toBe(foot);
		}
		// The first point is sample 5: sample 15 is -5, and sample 10 is 2 of the row's highest 4.
		const [first] = curves(scene, scene.rows[0]);
		expect(first[10][1]).toBe(feet(scene, scene.rows[0])[0]);
		expect(first[5][1]).toBeCloseTo(feet(scene, scene.rows[0])[0] - 20, 9);
	});

	test("grows each row it reaches by its strip, one strip under another, and no other", () => {
		const bare = lay().rows;
		const scene = lay({
			tracks: [
				track("forward", range(50, 75)),
				track("backward", range(130, 110, -1)),
			],
		});
		const strip = 6 + height("sans", 10.5) + 2 + 40;
		expect(scene.rows.map((row, i) => row.height - bare[i].height)).toEqual(
			[1, 2, 1, 0, 0].map((n) => expect.closeTo(n * strip, 9)),
		);
		const [row] = scene.rows;
		expect(feet(scene, row)).toEqual([expect.closeTo(row.y + row.height, 9)]);
		const [one, other] = feet(scene, scene.rows[1]);
		expect(other - one).toBeCloseTo(strip, 9);
	});

	test("is named over its strip, the key A C G T after the name, each letter in its curve's colour", () => {
		const forward = track("3730", range(50, 75));
		const space = measure(" ", "sans", 10.5);
		const named = key(
			lay({ tracks: [forward] }),
			lay({ tracks: [forward] }).rows[0],
		);
		expect(named.map((t) => [t.text, t.fill])).toEqual([
			["3730", "#252525"],
			["A", "#228833"],
			["C", "#4477aa"],
			["G", "#000000"],
			["T", "#cc3311"],
		]);
		expect(new Set(named.map((t) => [t.y, t.size, t.anchor].join()))).toEqual(
			new Set([[named[0].y, 10.5, "start"].join()]),
		);
		const after = measure("3730", "sans", 10.5) + 2 * space;
		const letters = [after];
		for (const letter of "ACG") {
			letters.push(
				(letters.at(-1) as number) + measure(letter, "sans", 10.5) + space,
			);
		}
		expect(named.map((t) => t.x)).toEqual(
			[0, ...letters].map((x) => expect.closeTo(x, 9)),
		);
		const blank = lay({ tracks: [{ ...forward, name: "" }] });
		expect(key(blank, blank.rows[0]).map((t) => [t.text, t.x])).toEqual([
			["A", 0],
			["C", expect.closeTo(letters[1] - after, 9)],
			["G", expect.closeTo(letters[2] - after, 9)],
			["T", expect.closeTo(letters[3] - after, 9)],
		]);
	});

	test("dims its whole strip where a highlight leaves its name unlit", () => {
		const forward = track("", range(50, 75));
		const scene = lay(
			{
				tracks: [
					{ ...forward, name: "dimmed" },
					{ ...forward, name: "lit" },
				],
			},
			{ highlight: ["LIT"] },
		);
		const [upper, lower] = feet(scene, scene.rows[0]);
		const paints = (from: number, to: number) =>
			new Set(
				scene.shapes
					.filter((s) => {
						const ys =
							s.shape === "text"
								? [s.y]
								: s.shape === "line"
									? [s.y1]
									: s.shape === "path"
										? s.commands.map((c) => c.at(-1) as number)
										: [];
						return ys.length > 0 && ys.every((y) => from < y && y <= to);
					})
					.map((s) => (s.shape === "text" ? s.fill : (s as Line).stroke)),
			);
		expect(paints(lay().rows[0].height, upper)).toEqual(new Set(["#dddddd"]));
		expect(paints(upper, lower)).toEqual(
			new Set([
				"#252525",
				"#7f7f7f",
				"#228833",
				"#4477aa",
				"#000000",
				"#cc3311",
			]),
		);
	});

	test("is left out where the kind is off", () => {
		const tracks = [track("forward", range(50, 75))];
		expect(lay({ tracks }, { kinds_off: ["tracks"] })).toEqual(lay());
	});

	test("draws nothing on the line or the circle", () => {
		const tracks = [track("forward", range(50, 75))];
		for (const map of ["line", "circle"]) {
			const record = { name: "test", circular: true, bases: BASES };
			expect(prepare({ ...record, tracks }, { map })).toEqual(
				prepare(record, { map }),
			);
		}
	});

	test.each(Object.entries(TRACES))(
		"from %s lays each peak over its base's middle, the curves running along its read",
		(name, record) => {
			const checked = check(record);
			const scene = layoutSequence(
				checked,
				checkOptions({ sequence_view: true }, checked),
			);
			const step = name.includes("reversed") ? -1 : 1;
			const [{ peaks }] = checked.tracks;
			expect(scene.rows).toHaveLength(2);
			for (const [i, row] of scene.rows.entries()) {
				const [points, ...others] = curves(scene, row);
				expect(others).toEqual([]);
				const xs = points.map(([x]) => x);
				expect(xs.slice(1).every((x, j) => Math.sign(x - xs[j]) === step)).toBe(
					true,
				);
				expect(xs.every((x) => x >= 0 && x < 60 * CELL)).toBe(true);
				const middles = peaks
					.filter(([, base]) => Math.floor(base / 60) === i)
					.map(([, base]) => (base - i * 60 + 0.5) * CELL);
				expect(middles).toHaveLength(60);
				for (const x of middles) {
					expect(xs.some((one) => Math.abs(one - x) < 1e-9)).toBe(true);
				}
			}
		},
	);
});
