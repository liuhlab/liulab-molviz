/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { checkOptions } from "../../../src/viewer/format/options";
import { check } from "../../../src/viewer/format/record";
import type { Shape } from "../../../src/viewer/scene";
import {
	layoutSequence,
	type SequenceScene,
} from "../../../src/viewer/sequence/view";

type Polygon = Extract<Shape, { shape: "polygon" }>;
type Text = Extract<Shape, { shape: "text" }>;

/** The bar's colour of each feature `cds` makes. */
const BAR = "#000001";

/** A forward CDS from `segments`, reading `translation`, its bar filled `BAR`. */
function cds(
	translation: string,
	segments: [number, number][],
	more: object = {},
): object {
	return {
		name: "",
		type: "CDS",
		strand: 1,
		color: BAR,
		translation,
		segments: segments.map(([start, end]) => ({ start, end })),
		...more,
	};
}

function lay(
	record: object,
	options: object = {},
	bases = "ATGAAATAGACGTACGTACGTACGT",
): SequenceScene {
	const checked = check({
		name: "test",
		circular: false,
		bases,
		...record,
	});
	return layoutSequence(
		checked,
		checkOptions({ sequence_view: true, ...options }, checked),
	);
}

function polygons(scene: SequenceScene): Polygon[] {
	return scene.shapes.filter((s): s is Polygon => s.shape === "polygon");
}

/** The chips: every polygon not filled as a bar, top to bottom, then left to right. */
function chipsOf(scene: SequenceScene, bar = BAR): Polygon[] {
	return polygons(scene)
		.filter((p) => p.fill !== bar)
		.sort((a, b) => top(a) - top(b) || left(a) - left(b));
}

/** The chips' letters: mono text not set in cells, top to bottom, then left to right. */
function lettersOf(scene: SequenceScene): Text[] {
	return scene.shapes
		.filter(
			(s): s is Text =>
				s.shape === "text" && s.face === "mono" && s.cell === undefined,
		)
		.sort((a, b) => a.y - b.y || a.x - b.x);
}

function top(p: Polygon): number {
	return Math.min(...p.points.map(([, y]) => y));
}

function bottom(p: Polygon): number {
	return Math.max(...p.points.map(([, y]) => y));
}

function left(p: Polygon): number {
	return Math.min(...p.points.map(([x]) => x));
}

/** `p`'s points, each from its top. */
function shape(p: Polygon): [number, number][] {
	return p.points.map(([x, y]) => [x, y - top(p)]);
}

/** A chip over the cells from `x1` to `x2`, pointing right, or left when `reverse`. */
function chevron(x1: number, x2: number, reverse = false): [number, number][] {
	const d = reverse ? -3 : 3;
	return [
		[x1, 0],
		[x2, 0],
		[x2 + d, 7.5],
		[x2, 15],
		[x1, 15],
		[x1 + d, 7.5],
	];
}

describe("chips", () => {
	test("set a chevron over each codon of a translated bar, its letter centred, a colour per amino acid", () => {
		const scene = lay({
			features: [
				cds("MK*", [[0, 9]]),
				{
					name: "",
					type: "CDS",
					strand: 1,
					color: BAR,
					segments: [{ start: 10, end: 20 }],
				},
			],
		});
		const chips = chipsOf(scene);
		expect(chips.map(shape)).toEqual([
			chevron(0, 33),
			chevron(33, 66),
			chevron(66, 99),
		]);
		expect(chips.map((c) => c.fill)).toEqual(["#f9d79c", "#afe8d1", "#cc3311"]);
		const letters = lettersOf(scene);
		expect(letters.map((t) => [t.text, t.x, t.anchor, t.fill])).toEqual([
			["M", 16.5, "middle", "#000000"],
			["K", 49.5, "middle", "#000000"],
			["*", 82.5, "middle", "#ffffff"],
		]);
		const [bar] = polygons(scene).filter((p) => p.fill === BAR);
		expect(top(bar)).toBe(bottom(chips[0]) + 1);
	});

	test("split a codon a join or a row cuts, its letter on the chip holding the middle base", () => {
		const scene = lay(
			{
				features: [
					cds("MKAQE*", [
						[0, 5],
						[7, 20],
					]),
				],
			},
			{ bases_per_row: 10 },
		);
		const chips = chipsOf(scene);
		expect(chips.map(shape)).toEqual([
			chevron(0, 33),
			chevron(33, 55),
			chevron(77, 88),
			chevron(88, 110),
			chevron(0, 11),
			chevron(11, 44),
			chevron(44, 77),
			chevron(77, 110),
		]);
		expect(top(chips[4])).toBeGreaterThan(top(chips[3]));
		expect(lettersOf(scene).map((t) => [t.text, t.x])).toEqual([
			["M", 16.5],
			["K", 44],
			["A", 99],
			["Q", 27.5],
			["E", 60.5],
			["*", 93.5],
		]);
	});

	test("read a reverse feature from its last segment's end down, each chevron pointing left", () => {
		const scene = lay({
			features: [
				cds(
					"MK*",
					[
						[0, 4],
						[6, 11],
					],
					{ strand: -1 },
				),
			],
		});
		const chips = chipsOf(scene);
		expect(chips.map(shape)).toEqual([
			chevron(0, 33, true),
			chevron(33, 44, true),
			chevron(66, 88, true),
			chevron(88, 121, true),
		]);
		expect(chips.map((c) => c.fill)).toEqual([
			"#cc3311",
			"#afe8d1",
			"#afe8d1",
			"#f9d79c",
		]);
		expect(lettersOf(scene).map((t) => [t.text, t.x])).toEqual([
			["*", 16.5],
			["K", 77],
			["M", 104.5],
		]);
	});

	test("follow a feature across the origin, from its codon_start", () => {
		const record = {
			circular: true,
			features: [cds("MK", [[20, 29]], { codon_start: 2 })],
		};
		const across = lay(record, { span: { start: 20, end: 30 } });
		expect(chipsOf(across).map(shape)).toEqual([
			chevron(11, 44),
			chevron(44, 77),
		]);
		expect(lettersOf(across).map((t) => [t.text, t.x])).toEqual([
			["M", 27.5],
			["K", 60.5],
		]);
		const whole = lay(record);
		expect(chipsOf(whole).map(shape)).toEqual([
			chevron(0, 22),
			chevron(231, 264),
			chevron(264, 275),
		]);
		expect(lettersOf(whole).map((t) => [t.text, t.x])).toEqual([
			["K", 11],
			["M", 247.5],
		]);
	});

	test.each([
		[1, ["K", "A", "M"]],
		[-1, ["K", "M", "A"]],
	])(
		"follow a feature on strand %i off a linear record's end and on from its start",
		(strand, read) => {
			// Codon K is 23, 2, 3 forward, and 3, 2, 23 reverse: its middle base is in the first row.
			const scene = lay(
				{
					features: [
						cds(
							"MKA",
							[
								[20, 24],
								[2, 7],
							],
							{ strand },
						),
					],
				},
				{ bases_per_row: 10 },
			);
			const reverse = strand === -1;
			expect(chipsOf(scene).map(shape)).toEqual([
				chevron(22, 44, reverse),
				chevron(44, 77, reverse),
				chevron(0, 33, reverse),
				chevron(33, 44, reverse),
			]);
			const letters = lettersOf(scene);
			expect(letters.map((t) => [t.text, t.x])).toEqual([
				[read[0], 33],
				[read[1], 60.5],
				[read[2], 16.5],
			]);
			expect(letters[2].y).toBeGreaterThan(scene.rows[2].y);
		},
	);

	test("dim to one grey with their feature, under a highlight that leaves it unlit", () => {
		const scene = lay(
			{
				features: [
					cds("MK*", [[0, 9]], { name: "lacZ" }),
					{
						name: "ori",
						type: "rep_origin",
						strand: 1,
						segments: [{ start: 12, end: 20 }],
					},
				],
			},
			{ highlight: ["ori"] },
		);
		const grey = polygons(scene).filter((p) => p.fill === "#dddddd");
		expect(grey).toHaveLength(4);
		expect(lettersOf(scene).map((t) => [t.text, t.fill])).toEqual([
			["M", "#000000"],
			["K", "#000000"],
			["*", "#000000"],
		]);
	});

	const translated = Object.entries(
		import.meta.glob("../../records/*.json", {
			eager: true,
			import: "default",
		}),
	)
		.map(([file, input]) => [file, check(input)] as const)
		.filter(([, record]) => record.features.some((f) => f.translation));

	test.each(translated)(
		"show every letter of each translation in %s once",
		(_, record) => {
			const scene = layoutSequence(
				record,
				checkOptions({ sequence_view: true }, record),
			);
			const sorted = (letters: string[]) => letters.sort().join("");
			expect(sorted(lettersOf(scene).map((t) => t.text))).toBe(
				sorted(record.features.flatMap((f) => [...(f.translation ?? "")])),
			);
		},
	);
});
