import { describe, expect, test } from "vitest";
import type { Hidden, Kind, Label } from "../../src/viewer/labels";
import type { Box, Shape } from "../../src/viewer/scene";
import { type Anchored, labelsAbove } from "../../src/viewer/staircase";

/** A label that says `name`, boxed as a feature's name is unless `kind` says otherwise. */
function label(
	name: string,
	{
		kind = "features",
		fewestCuts = 0,
		dim = false,
	}: { kind?: Kind; fewestCuts?: number; dim?: boolean } = {},
): Label {
	const item: Hidden =
		kind === "cuts" || kind === "insertions"
			? { kind, name, at: 0 }
			: { kind, name, spans: [] };
	return {
		...item,
		runs: [{ text: name, face: "sans" }],
		color: "#dddddd",
		dim,
		fewestCuts,
	};
}

/** `labels` anchored at `x`, their leaders rising from the line's top, 0. */
function at(x: number, labels: readonly Label[]): Anchored[] {
	return labels.map((one) => ({ label: one, x, foot: 0 }));
}

/** `count` boxed labels, named `prefix` and a number from 0. */
function many(count: number, prefix = "n"): Label[] {
	return Array.from({ length: count }, (_, i) => label(`${prefix}${i}`));
}

function boxes(shapes: readonly Shape[]): Box[] {
	return shapes.flatMap((s) => (s.shape === "rect" ? [s] : []));
}

function names(hidden: readonly Label[]): string[] {
	return hidden.map((one) => one.name);
}

/** The highest a box may reach: 730 pt above the line's top. */
const CEILING = -730;

describe("labelsAbove", () => {
	// Rows of boxes 2 pt apart, the lowest ending 10 pt above the line: 41 fit under the ceiling.
	test.each([
		[41, 0],
		[42, 1],
		[60, 19],
	])(
		"hides the fewest of %i labels at one point, %i, to keep the rest under the ceiling",
		(count, hides) => {
			const { shapes, hidden } = labelsAbove(at(100, many(count)), 0);
			expect(hidden).toHaveLength(hides);
			const shown = boxes(shapes);
			expect(shown).toHaveLength(count - hides);
			for (const box of shown) expect(box.y).toBeGreaterThanOrEqual(CEILING);
		},
	);

	test("hides in the hiding order, and lists them in the order they hid", () => {
		const site = (name: string, fewestCuts: number) =>
			label(name, { kind: "cuts", fewestCuts });
		const fillers = Array.from({ length: 41 }, (_, i) =>
			site(`E${10 + i} (1)`, 1),
		);
		const crowd = [
			site("BsaI (2)", 2),
			...fillers.slice(0, 20),
			site("a much longer name (9)", 1),
			...fillers.slice(20),
			site("BsmBI (30)", 2),
			site("EcoRI (1)", 3),
		];
		const { hidden } = labelsAbove(at(100, crowd), 0);
		expect(names(hidden)).toEqual([
			"EcoRI (1)",
			"BsmBI (30)",
			"BsaI (2)",
			"a much longer name (9)",
		]);
	});

	test("hides a lit label last", () => {
		const dimmed = Array.from({ length: 41 }, (_, i) =>
			label(`n${i}`, { kind: "cuts", fewestCuts: 1, dim: true }),
		);
		const lit = label("cut most", { kind: "cuts", fewestCuts: 5 });
		const { hidden } = labelsAbove(at(100, [lit, ...dimmed]), 0);
		expect(names(hidden)).toEqual(["n10"]);
	});

	test("hides only in a crowd past the ceiling, never a label clear of it", () => {
		const far = many(5, "first to hide, being longest ");
		const { shapes, hidden } = labelsAbove(
			[...at(100, many(60)), ...at(600, far)],
			0,
		);
		expect(hidden).toHaveLength(19);
		expect(hidden.filter((one) => far.includes(one))).toEqual([]);
		for (const box of boxes(shapes))
			expect(box.y).toBeGreaterThanOrEqual(CEILING);
	});

	test("lists a label anchored at two points once", () => {
		const twice = label("the longest name, first to hide");
		const { hidden } = labelsAbove(at(100, [twice, ...many(41), twice]), 0);
		expect(hidden).toEqual([twice]);
	});

	test("never lists a label that hides from the stack but shows in place", () => {
		const shown = label("the longest name, first to hide");
		const { shapes, hidden } = labelsAbove(at(100, [shown, ...many(41)]), 0, {
			inPlace: [shown],
		});
		expect(boxes(shapes)).toHaveLength(41);
		expect(hidden).toEqual([]);
	});

	test("hides only from the stack too tall, never a label beside it", () => {
		// A stack at 100 must hide 4. A wide label first to hide reaches from it to labels at 400,
		// some next to hide, that fit; nothing in the stack rests on it.
		const site = (name: string, fewestCuts: number) =>
			label(name, { kind: "cuts", fewestCuts });
		const left = Array.from({ length: 45 }, (_, i) =>
			site(`A${String(i + 1).padStart(2, "0")}`, 2),
		);
		const right = Array.from({ length: 30 }, (_, i) =>
			site(`B${String(i + 1).padStart(2, "0")}`, i < 10 ? 3 : 1),
		);
		const bridge = site("a label wide enough to reach both crowds", 9);
		const { hidden } = labelsAbove(
			[...at(100, left), ...at(250, [bridge]), ...at(400, right)],
			0,
		);
		expect(names(hidden)).toEqual(["A01", "A02", "A03", "A04"]);
	});

	test("counts a box as resting on the one nearest its leader, where two hold it as high", () => {
		// The wide box rests on "short" under its leader and on the far site, both on the lowest
		// row; the stack at 100 must hide 1.
		const site = (name: string, fewestCuts: number) =>
			label(name, { kind: "cuts", fewestCuts });
		const far = site("far (9)", 9);
		const stack = [
			label("short"),
			label("a wide name that reaches the far site"),
			...Array.from({ length: 40 }, (_, i) => site(`n${i}`, 1)),
		];
		const { hidden } = labelsAbove([...at(100, stack), ...at(250, [far])], 0);
		expect(names(hidden)).toEqual(["n10"]);
	});
});
