import { describe, expect, test } from "vitest";
import {
	type Columns,
	columns,
	REACH,
	type Unplaced,
} from "../../../src/viewer/map/columns";
import {
	closestToCentre,
	crosses,
	nearestToCentre,
	overlap,
	TOUCH,
} from "../round";

/** The drawing's radius in the examples built by hand. */
const RADIUS = 200;

/** A point `radius` from the centre at `degrees` clockwise from the top. */
function point(degrees: number, radius: number) {
	const angle = (degrees * Math.PI) / 180;
	return { x: radius * Math.sin(angle), y: -radius * Math.cos(angle) };
}

/** A label `width` by `height` whose leader starts 4 points beyond the drawing at `degrees`. */
function label(
	degrees: number,
	width: number,
	height = 16,
	radius = RADIUS,
): Unplaced {
	return { width, height, anchor: point(degrees, radius + 4) };
}

describe("a lone label", () => {
	test("sits level with its anchor, its inner edge 14 points beyond the drawing", () => {
		const { placed, hidden } = columns(
			[label(90, 50), label(270, 30)],
			[0, 1],
			RADIUS,
		);
		expect(hidden).toEqual([]);
		const [right, left] = placed;
		expect(right?.box.x).toBeCloseTo(214);
		expect(right?.box.y).toBeCloseTo(-8);
		expect(right?.leader[1].x).toBeCloseTo(214);
		expect(right?.leader[1].y).toBeCloseTo(0);
		expect(left?.box.x).toBeCloseTo(-244);
		expect(left?.box.y).toBeCloseTo(-8);
		expect(left?.leader[1].x).toBeCloseTo(-214);
	});
});

/** The drawing's radius in the generated cases: the outer edge of the circle's backbone. */
const DRAWING = 221.3;

/** A label's height: 11.5-point text and a point above and below it. */
const HEIGHT = 15.4;

/** A seeded generator of numbers in [0, 1), mulberry32. */
function seeded(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Labels to place, each with the angle its anchor lies at, in degrees from the top. */
interface Case {
	readonly degrees: readonly number[];
	readonly widths: readonly number[];
	readonly heights: readonly number[];
}

function random(seed: number): Case {
	const next = seeded(seed);
	const degrees = Array.from({ length: 40 }, () => 360 * next());
	return {
		degrees,
		widths: degrees.map(() => 20 + 140 * next()),
		heights: degrees.map(() => 12 + 6 * next()),
	};
}

/** `count` angles `step` degrees apart from `from`. */
function run(count: number, from: number, step: number): number[] {
	return Array.from({ length: count }, (_, i) => from + step * i);
}

/** Labels crowding one stretch, the origin and both sides, and wide ones at the bottom. */
function crowded(): Case {
	const narrow = [
		...run(40, 45.3, 0.75),
		...run(12, 356.3, 0.7),
		...run(8, 88.3, 1),
		...run(8, 268.3, 1),
	];
	const wide = run(12, 177.3, 0.5);
	return {
		degrees: [...narrow, ...wide],
		widths: [
			...narrow.map((_, i) => 60 + (i % 7) * 15),
			...wide.map(() => 220),
		],
		heights: [...narrow, ...wide].map(() => HEIGHT),
	};
}

/** Twelve labels well apart all round the circle. */
function sparse(): Case {
	const degrees = Array.from({ length: 12 }, (_, i) => 15.3 + 30 * i);
	return {
		degrees,
		widths: degrees.map((_, i) => 40 + 10 * i),
		heights: degrees.map(() => HEIGHT),
	};
}

/** Tall labels crowded low on the left, where a leader to a box's middle would clip the next. */
function tall(): Case {
	// biome-ignore format: a table reads better packed
	const given = [
		[251.18, 168, 12.7], [254.52, 64.8, 26], [254.72, 157.6, 26.9], [249.78, 59.3, 19.1],
		[253.28, 126, 12.4], [248.94, 122.6, 12.1], [250.25, 100.8, 12.2], [249.8, 30.9, 38.5],
		[254.72, 35.6, 12.4], [254.92, 148.8, 30.7], [248.93, 146.6, 35.7],
	];
	return {
		degrees: given.map(([d]) => d),
		widths: given.map(([, w]) => w),
		heights: given.map(([, , h]) => h),
	};
}

const CASES: [string, Case][] = [
	["random 1", random(1)],
	["random 2", random(2)],
	["random 3", random(3)],
	["crowded", crowded()],
	["sparse", sparse()],
	["tall", tall()],
];

/** Each case turned by each of these, in degrees, as a page turns the circle. */
const ROTATIONS = [0, 45, 90, 180, 250, 333];

/** A case turned by `rotation`, laid out, with each anchor's clockwise angle in degrees. */
function lay({ degrees, widths, heights }: Case, rotation: number) {
	const turned = degrees.map((d) => (((d + rotation) % 360) + 360) % 360);
	const labels = turned.map((d, i) => ({
		width: widths[i],
		height: heights[i],
		anchor: point(d, DRAWING + 4),
	}));
	const next = seeded(rotation + 7);
	const order = labels
		.map((_, i) => [next(), i] as const)
		.sort(([a], [b]) => a - b)
		.map(([, i]) => i);
	return { labels, order, turned, laid: columns(labels, order, DRAWING) };
}

/** Each label placed, with its index. */
function shown(laid: Columns) {
	return laid.placed.flatMap((one, i) => (one ? [{ ...one, i }] : []));
}

describe.each(CASES)("%s", (_, given) => {
	describe.each(ROTATIONS)("turned %i degrees", (rotation) => {
		const { labels, order, turned, laid } = lay(given, rotation);
		const boxes = shown(laid);

		test("places or hides each label exactly once", () => {
			expect(new Set(laid.hidden).size).toBe(laid.hidden.length);
			const hidden = labels.flatMap((_, i) => (laid.placed[i] ? [] : [i]));
			expect([...laid.hidden].sort((a, b) => a - b)).toEqual(hidden);
		});

		test("every label lies within the reach of the centre", () => {
			for (const { box } of boxes) {
				expect(box.y).toBeGreaterThanOrEqual(-REACH);
				expect(box.y + box.height).toBeLessThanOrEqual(REACH);
			}
		});

		test("labels hide in the order given", () => {
			const ranks = laid.hidden.map((i) => order.indexOf(i));
			expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
		});

		test("no two labels overlap", () => {
			const pairs = boxes.flatMap((one, k) =>
				boxes.slice(k + 1).filter((other) => overlap(one.box, other.box)),
			);
			expect(pairs).toEqual([]);
		});

		test("no label overlaps the drawing", () => {
			for (const { box } of boxes)
				expect(nearestToCentre(box)).toBeGreaterThanOrEqual(DRAWING);
		});

		test("each label sits on its anchor's side, 3 points clear of the middle", () => {
			for (const { box, i } of boxes) {
				if (turned[i] < 180) expect(box.x).toBeGreaterThan(3);
				else expect(box.x + box.width).toBeLessThan(-3);
			}
		});

		test("each column keeps its labels in the order their anchors run", () => {
			const down = (side: (d: number) => boolean, sign: number) =>
				boxes
					.filter(({ i }) => side(turned[i]))
					.sort((a, b) => sign * (turned[a.i] - turned[b.i]))
					.map(({ box }) => box.y);
			for (const ys of [down((d) => d < 180, 1), down((d) => d >= 180, -1)])
				expect(ys).toEqual([...ys].sort((a, b) => a - b));
		});

		test("each leader runs from its anchor to its box's inner edge", () => {
			for (const { box, leader, i } of boxes) {
				expect(leader[0]).toEqual(labels[i].anchor);
				const edge = turned[i] < 180 ? box.x : box.x + box.width;
				expect(leader[1].x).toBeCloseTo(edge, 9);
				expect(leader[1].y).toBeGreaterThanOrEqual(box.y);
				expect(leader[1].y).toBeLessThanOrEqual(box.y + box.height);
			}
		});

		test("no leader enters the drawing", () => {
			for (const { leader } of boxes)
				expect(closestToCentre(leader)).toBeGreaterThanOrEqual(DRAWING - TOUCH);
		});

		test("no leader crosses a label other than its own", () => {
			const crossings = boxes.flatMap((one) =>
				boxes
					.filter((other) => other !== one && crosses(one.leader, other.box))
					.map((other) => [one.i, other.i]),
			);
			expect(crossings).toEqual([]);
		});
	});
});

describe("hiding", () => {
	test("only a crowd past the reach hides, the first in order first", () => {
		// Thirty labels crowd the top right; lower down the same column, and on the left, a label
		// comes earlier in the order than any of them but stands alone.
		const crowd = Array.from({ length: 30 }, (_, i) => label(20 + i / 3, 80));
		const alone = [label(150, 80), label(300, 80)];
		const labels = [...crowd, ...alone];
		const order = [30, 31, ...crowd.map((_, i) => (i * 7) % 30)];
		const { hidden } = columns(labels, order, RADIUS);
		expect(hidden.length).toBeGreaterThan(0);
		expect(hidden).toEqual(order.slice(2, 2 + hidden.length));
	});

	test("a column within the reach hides nothing", () => {
		const labels = Array.from({ length: 30 }, (_, i) => label(3 + 6 * i, 80));
		expect(columns(labels, [...labels.keys()], RADIUS).hidden).toEqual([]);
	});
});
