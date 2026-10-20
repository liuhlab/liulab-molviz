import { describe, expect, test } from "vitest";
import { coloredFeatures } from "../../src/viewer/arrows";
import { cutSites } from "../../src/viewer/cuts";
import {
	disagreementLabel,
	insertionLabel,
	type Label,
	primerLabel,
	readLabel,
} from "../../src/viewer/labels";
import { checkOptions } from "../../src/viewer/options";
import { check, type Record, recordBounds } from "../../src/viewer/record";
import {
	caption,
	clicked,
	copied,
	dragFrom,
	dragged,
	dragTo,
	itemKey,
	itemSelection,
	turnTo,
} from "../../src/viewer/selection";
import insertionsFile from "../records/both-strands-and-insertions.json";
import colourTestFile from "../records/colour-test.json";
import cutAtOriginFile from "../records/n-and-cut-at-origin.json";
import ampliconFile from "../records/puc19-backbone-amplicon.json";
import productFile from "../records/puc19-gfp-product.json";
import verifiedFile from "../records/puc19-gfp-verification.json";

const product = check(productFile);
const amplicon = check(ampliconFile);
const colourTest = check(colourTestFile);
const insertions = check(insertionsFile);
const cutAtOrigin = check(cutAtOriginFile);
const verified = check(verifiedFile);

/** The label a drawing gives `record`'s feature named `name`. */
function featureLabel(record: Record, name: string): Label {
	const options = checkOptions({}, record);
	const found = coloredFeatures(record, options).find(
		({ feature }) => feature.name === name,
	);
	if (!found) throw new Error(`no feature ${name}`);
	return found.label;
}

/** What a click on the item `label` names selects, as its caption says it. */
function clickedCaption(record: Record, label: Label, enzymes: string[] = []) {
	const selection = itemSelection(itemKey(label), record, enzymes);
	return caption(selection, recordBounds(record));
}

describe("a click on an item", () => {
	test("on a feature selects from its first segment to its last", () => {
		// lacZα is joined across the GFP insert.
		expect(clickedCaption(product, featureLabel(product, "lacZα"))).toBe(
			"146 .. 1130 (985 bp)",
		);
	});

	test("on a feature across a linear end selects its part either side, not the joins to the end", () => {
		expect(clickedCaption(amplicon, featureLabel(amplicon, "lacZα"))).toBe(
			"2395 .. 2644, 15 .. 32 (268 bp)",
		);
	});

	test("on a feature across a circle's origin selects one span past the length", () => {
		const selection = itemSelection(
			itemKey(featureLabel(colourTest, "across")),
			colourTest,
			[],
		);
		expect(selection).toMatchObject({ spans: [{ start: 2600, end: 2750 }] });
		expect(caption(selection, recordBounds(colourTest))).toBe(
			"2601 .. 64 (150 bp)",
		);
	});

	test("on a primer's site, a read or a disagreement over a span selects that span", () => {
		const bounds = recordBounds(verified);
		const primer = verified.primers.find(
			({ name }) => name === "Sequencing forward",
		);
		if (!primer) throw new Error("no primer");
		const labels = [
			primerLabel(primer.name, primer.sites[0], bounds.length, []),
			readLabel(verified.reads[0], bounds.length, []),
			disagreementLabel(verified.disagreements[0], bounds, []).label,
		];
		expect(labels.map((label) => clickedCaption(verified, label))).toEqual([
			"257 .. 272 (16 bp)",
			"1 .. 3347 (3347 bp)",
			"696 .. 696 (1 bp)",
		]);
	});

	test("on a cut site selects its recognition span, which need not hold the cut", () => {
		// BbsI cuts at 14 and recognises 6..12; EcoRI cuts at 0 and recognises 47..53.
		const [bbsI] = cutSites(amplicon, ["BbsI"]);
		const [ecoRI] = cutSites(cutAtOrigin, ["EcoRI"]);
		expect([
			clickedCaption(amplicon, bbsI.label, ["BbsI"]),
			clickedCaption(cutAtOrigin, ecoRI.label, ["EcoRI"]),
		]).toEqual(["7 .. 12 (6 bp)", "48 .. 5 (6 bp)"]);
	});

	test("on a cut site of several enzymes selects from the first recognition span to the last, of the enzymes on", () => {
		const cuts = (circular: boolean, spans: [string, number, number][]) =>
			check({
				name: "cuts",
				circular,
				bases: "A".repeat(48),
				cuts: spans.map(([enzyme, start, end]) => ({
					enzyme,
					start,
					end,
					at: 0,
					stagger: 0,
				})),
			});
		const linear = cuts(false, [
			["X", 0, 6],
			["Y", 2, 8],
			["Z", 4, 10],
		]);
		const circle = cuts(true, [
			["X", 46, 52],
			["Y", 0, 6],
		]);
		const selected = (record: Record, enzymes: string[]) =>
			clickedCaption(record, cutSites(record, enzymes)[0].label, enzymes);
		expect([
			selected(linear, ["X", "Y"]),
			selected(linear, ["x", "z"]),
			selected(circle, ["X", "Y"]),
		]).toEqual(["1 .. 8 (8 bp)", "1 .. 10 (10 bp)", "47 .. 6 (8 bp)"]);
	});

	test("on an insertion or a disagreement at a point selects the point, with nothing to copy", () => {
		const bounds = recordBounds(insertions);
		const [barcode, spacer] = insertions.insertions.map(
			(one) => insertionLabel(one, bounds, []).label,
		);
		const added = check({
			name: "added",
			circular: false,
			bases: "ACGTACGTAC",
			reads: [{ name: "r", start: 0, end: 10, strand: 1 }],
			disagreements: [{ name: "4^5 +T", at: 4, bases: "T", reads: ["r"] }],
		});
		const [point] = added.disagreements.map(
			(one) => disagreementLabel(one, recordBounds(added), []).label,
		);
		const items: [Label, Record][] = [
			[barcode, insertions],
			[spacer, insertions],
			[point, added],
		];
		const selected = items.map(([label, record]) => {
			const selection = itemSelection(itemKey(label), record, []);
			return [
				caption(selection, recordBounds(record)),
				copied(selection, record.bases),
			];
		});
		expect(selected).toEqual([
			["45^46", ""],
			["60^1", ""],
			["4^5", ""],
		]);
	});
});

describe("an item's key", () => {
	test("that names no item is refused", () => {
		for (const key of ["lacZ", '{"kind":"features","name":"lacZ"}']) {
			expect(() => itemSelection(key, product, [])).toThrow("names no item");
		}
	});
});

describe("clicked", () => {
	const [lacZ, ampR] = ["lacZα", "AmpR"].map((name) =>
		itemSelection(itemKey(featureLabel(product, name)), product, []),
	);

	test("selects an item, and another in its place", () => {
		expect(clicked(null, lacZ)).toBe(lacZ);
		expect(clicked(lacZ, ampR)).toBe(ampR);
	});

	test("clears on the item selected, or on no item", () => {
		const again = itemSelection(
			itemKey(featureLabel(product, "lacZα")),
			product,
			[],
		);
		expect(clicked(lacZ, again)).toBeNull();
		expect(clicked(lacZ, null)).toBeNull();
	});
});

describe("a drag across the line or the bases", () => {
	/** The caption of a drag over `bases`, in the order the pointer meets them. */
	const across = (record: Record, bases: number[]) => {
		const drag = bases.slice(1).reduce(dragTo, dragFrom(bases[0]));
		const selection = dragged(drag, recordBounds(record));
		expect(selection.item).toBeNull();
		return caption(selection, recordBounds(record));
	};

	test("selects from the base pressed to the base under the pointer, either way", () => {
		expect([
			across(product, [150]),
			across(product, [150, 200, 275]),
			across(product, [275, 150]),
			across(product, [150, 400, 140]),
		]).toEqual([
			"151 .. 151 (1 bp)",
			"151 .. 276 (126 bp)",
			"151 .. 276 (126 bp)",
			"141 .. 151 (11 bp)",
		]);
	});

	test("across a circle's origin, on a line over a span that crosses it, selects one span past the length", () => {
		// The line over 2600..2750 counts the bases after the origin past the length.
		expect(across(colourTest, [2680, 2700])).toBe("2681 .. 15 (21 bp)");
		expect(
			dragged(dragTo(dragFrom(2700), 2690), recordBounds(colourTest)),
		).toMatchObject({ spans: [{ start: 4, end: 15 }] });
	});
});

describe("a drag around the circle", () => {
	// n-and-cut-at-origin is 48 bp around.
	const around = (bases: number[]) => {
		const drag = bases
			.slice(1)
			.reduce((sofar, base) => turnTo(sofar, base, 48), dragFrom(bases[0]));
		return caption(
			dragged(drag, recordBounds(cutAtOrigin)),
			recordBounds(cutAtOrigin),
		);
	};

	test("follows the pointer across the origin, either way", () => {
		expect([around([46, 47, 0, 1]), around([1, 0, 47, 46])]).toEqual([
			"47 .. 2 (4 bp)",
			"47 .. 2 (4 bp)",
		]);
	});

	test("selects the whole record at a full turn, either way, and less once the pointer comes back", () => {
		const forward = [10, 22, 34, 46, 10];
		expect([
			around(forward),
			around([10, 46, 34, 22, 11]),
			around([...forward, 22, 10, 46, 34]),
		]).toEqual(["1 .. 48 (48 bp)", "1 .. 48 (48 bp)", "11 .. 35 (25 bp)"]);
	});
});

describe("copy", () => {
	test("takes the top strand's bases in reading order, on across a linear end or a circle's origin", () => {
		const copiedFeature = (circular: boolean, segments: number[][]) => {
			const record = check({
				name: "copy",
				circular,
				bases: "ACGTTGCAac",
				features: [
					{
						name: "f",
						type: "CDS",
						strand: -1,
						segments: segments.map(([start, end]) => ({ start, end })),
					},
				],
			});
			const selection = itemSelection(
				itemKey(featureLabel(record, "f")),
				record,
				[],
			);
			return copied(selection, record.bases);
		};
		expect([
			copiedFeature(false, [
				[7, 9],
				[1, 3],
			]),
			copiedFeature(true, [[7, 12]]),
		]).toEqual(["AaCG", "AacAC"]);
	});
});
