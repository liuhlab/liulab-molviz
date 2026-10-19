import * as v from "valibot";
import { describe, expect, test } from "vitest";
import { FormatError, parse } from "../../src/viewer/format";
import { type Bounds, base, check, point, span } from "../../src/viewer/record";

const good = { name: "pUC19", circular: true, bases: "GATCcatgRYN" };

describe("check", () => {
	test("returns a good record, with each missing list empty", () => {
		expect(check(good)).toStrictEqual({
			...good,
			features: [],
			primers: [],
			cuts: [],
			insertions: [],
			reads: [],
			disagreements: [],
			tracks: [],
		});
	});

	test("leaves out a codon_start that is not given", () => {
		const feature = {
			name: "a",
			type: "CDS",
			strand: 1,
			segments: [{ start: 0, end: 3 }],
			translation: "M",
		};
		expect(check({ ...good, features: [feature] }).features).toStrictEqual([
			feature,
		]);
	});

	test("rejects every key the format does not have", () => {
		expect(() => check({ ...good, colour: "red", shape: "round" })).toThrow(
			new FormatError("colour: unknown key\nshape: unknown key"),
		);
	});

	test.each([
		[
			{ ...good, bases: "ACGTX" },
			'bases: has "X" at index 4, which is not an IUPAC nucleotide letter',
		],
		[
			{ ...good, bases: "AC GT" },
			'bases: has " " at index 2, which is not an IUPAC nucleotide letter',
		],
		[{ ...good, bases: "" }, "bases: must hold at least one base"],
		[{ ...good, name: 7 }, "name: must be text"],
		[{ ...good, circular: "yes" }, "circular: must be true or false"],
		[{ name: "pUC19", bases: "ACGT" }, "circular: missing"],
		[null, "record: must be an object"],
		[[1], "record: must be an object"],
	])("rejects %j", (input, message) => {
		expect(() => check(input)).toThrow(new FormatError(message));
	});

	test("names every problem in one error, one per line", () => {
		expect(() =>
			check({ name: 7, circular: true, bases: "", colour: "red" }),
		).toThrow(
			new FormatError(
				"name: must be text\nbases: must hold at least one base\ncolour: unknown key",
			),
		);
	});
});

/** A 100 bp record holding `kinds`. */
function record(circular: boolean, kinds: object): unknown {
	return { name: "p", circular, bases: "ACGT".repeat(25), ...kinds };
}

/** The lines of the error checking `input` throws, as a record or against `schema`, or none. */
function problems(input: unknown, schema?: v.GenericSchema): string[] {
	try {
		if (schema) parse(schema, input);
		else check(input);
		return [];
	} catch (error) {
		return (error as FormatError).message.split("\n");
	}
}

describe("features", () => {
	const feature = {
		name: "lacZα",
		type: "CDS",
		strand: 1,
		segments: [{ start: 10, end: 40 }],
	};
	const features = (change: object) => ({
		features: [{ ...feature, ...change }],
	});
	const joined = {
		segments: [
			{ start: 90, end: 98 },
			{ start: 101, end: 108 },
		],
	};

	test("may join segments past the origin of a circular record", () => {
		expect(problems(record(true, features(joined)))).toEqual([]);
	});

	test("lie within a linear record", () => {
		expect(problems(record(false, features(joined)))).toEqual([
			"features[0].segments[1].start: must be less than the record's length, 100",
			"features[0].segments[1].end: must be at most the record's length, 100",
		]);
	});

	test.each<[string, boolean, object[], string[]]>([
		[
			"with a start equal to the one before",
			false,
			[
				{ start: 50, end: 60 },
				{ start: 50, end: 70 },
				{ start: 20, end: 30 },
			],
			[
				"features[0].segments[1].start: must be greater than the previous segment's start",
			],
		],
		[
			"running off a linear record's end and on from its start",
			false,
			[
				{ start: 90, end: 98 },
				{ start: 2, end: 9 },
			],
			[],
		],
		[
			"running off a linear record's end twice",
			false,
			[
				{ start: 50, end: 60 },
				{ start: 20, end: 30 },
				{ start: 10, end: 15 },
			],
			[
				"features[0].segments[2].start: must be greater than the previous segment's start: a feature runs off a linear record's end once",
			],
		],
		[
			"past where it began, after running off a linear record's end",
			false,
			[
				{ start: 50, end: 60 },
				{ start: 10, end: 20 },
				{ start: 30, end: 51 },
			],
			[
				"features[0].segments[2].end: must be at most segments[0].start, 50, once the feature has run off the end",
			],
		],
		[
			"up to where it began, after running off a linear record's end",
			false,
			[
				{ start: 50, end: 60 },
				{ start: 20, end: 50 },
			],
			[],
		],
		[
			"from a linear record's last base on from its first",
			false,
			[
				{ start: 90, end: 100 },
				{ start: 0, end: 5 },
			],
			[],
		],
		[
			"running back past the origin of a circular record",
			true,
			[
				{ start: 90, end: 98 },
				{ start: 2, end: 9 },
			],
			[
				"features[0].segments[1].start: must be greater than the previous segment's start",
			],
		],
		[
			"over more than one turn",
			true,
			[
				{ start: 90, end: 98 },
				{ start: 150, end: 191 },
			],
			[
				"features[0].segments[1].end: must be at most segments[0].start + 100, one turn of the record",
			],
		],
		[
			"with a middle segment ending past one turn",
			true,
			[
				{ start: 10, end: 20 },
				{ start: 30, end: 150 },
				{ start: 40, end: 50 },
			],
			[
				"features[0].segments[1].end: must be at most segments[0].start + 100, one turn of the record",
			],
		],
		[
			"with a middle segment ending past two turns",
			true,
			[
				{ start: 10, end: 20 },
				{ start: 30, end: 200 },
				{ start: 40, end: 50 },
			],
			[
				"features[0].segments[1].end: must be at most segments[0].start + 100, one turn of the record",
			],
		],
		[
			"over exactly one turn",
			true,
			[
				{ start: 90, end: 95 },
				{ start: 180, end: 190 },
			],
			[],
		],
		[
			"with no segments",
			true,
			[],
			["features[0].segments: must hold at least one segment"],
		],
		[
			"with a first segment past the length",
			true,
			[{ start: 100, end: 104 }],
			[
				"features[0].segments[0].start: must be less than the record's length, 100",
			],
		],
	])("%s", (_, isCircular, segments, expected) => {
		expect(problems(record(isCircular, features({ segments })))).toEqual(
			expected,
		);
	});

	test("may have an empty name, as a source feature may", () => {
		const source = {
			name: "",
			type: "source",
			strand: 0,
			segments: [{ start: 0, end: 100 }],
		};
		expect(problems(record(false, features(source)))).toEqual([]);
	});

	test("may carry colors, a translation and its codon_start", () => {
		const colored = {
			color: "#1f77B4",
			segments: [
				{ start: 10, end: 20, color: "#ff0000" },
				{ start: 30, end: 41 },
			],
			translation: "MTM*",
			codon_start: 3,
		};
		expect(problems(record(true, features(colored)))).toEqual([]);
	});

	test.each<[string, object, string[]]>([
		[
			"a strand that is not 1, -1, 0 or 2",
			{ strand: 3 },
			["features[0].strand: must be 1, -1, 0 or 2"],
		],
		[
			"colors not written #rrggbb",
			{ color: "red", segments: [{ start: 10, end: 40, color: "#fff" }] },
			[
				"features[0].segments[0].color: must be a color written #rrggbb",
				"features[0].color: must be a color written #rrggbb",
			],
		],
		[
			"a translation too long for its feature",
			{ translation: "MTMITPSL*K*" },
			[
				"features[0].translation: has 11 letters, 33 bases, more than the 30 the segments hold from codon_start",
			],
		],
		[
			"a translation that fits only from codon_start 1",
			{ translation: "MTMITPSLA*", codon_start: 2 },
			[
				"features[0].translation: has 10 letters, 30 bases, more than the 29 the segments hold from codon_start",
			],
		],
		[
			"a translation with a letter that is not a capital or *",
			{ translation: "MtM-" },
			[
				'features[0].translation: has "t" at index 1, which is not a capital letter or *',
			],
		],
		[
			"an empty translation",
			{ translation: "" },
			["features[0].translation: must hold at least one letter"],
		],
		[
			"a codon_start without a translation",
			{ codon_start: 1 },
			["features[0].codon_start: must come with a translation"],
		],
		[
			"a codon_start that is not 1, 2 or 3",
			{ translation: "M", codon_start: 0 },
			["features[0].codon_start: must be 1, 2 or 3"],
		],
		[
			"keys a feature does not have",
			{ qualifiers: {}, note: "a" },
			["features[0].qualifiers: unknown key", "features[0].note: unknown key"],
		],
	])("rejects %s", (_, change, expected) => {
		expect(problems(record(true, features(change)))).toEqual(expected);
	});
});

describe("primers", () => {
	// A 5' tail of 5 bases, then 18 that anneal.
	const primer = {
		name: "M13-fwd",
		bases: "gatcaGTAAAACGACGGCCAGTG",
		sites: [{ start: 10, end: 28, strand: 1 }],
	};
	const primers = (site: object, change: object = {}) => ({
		primers: [
			{ ...primer, ...change, sites: [{ ...primer.sites[0], ...site }] },
		],
	});

	test.each<[string, boolean, object]>([
		["with mismatches inside its site", false, { mismatches: [10, 27] }],
		["on the bottom strand", false, { strand: -1 }],
		[
			"across the origin, with a mismatch after it",
			true,
			{ start: 95, end: 105, mismatches: [2, 96] },
		],
		[
			"across the origin, with mismatches at both ends of the part after it",
			true,
			{ start: 95, end: 105, mismatches: [0, 4] },
		],
		["as wide as the primer", false, { start: 0, end: 23 }],
	])("binds %s", (_, isCircular, site) => {
		expect(problems(record(isCircular, primers(site)))).toEqual([]);
	});

	test("may have an empty name and bind nowhere", () => {
		const unbound = { primers: [{ ...primer, name: "", sites: [] }] };
		expect(problems(record(true, unbound))).toEqual([]);
	});

	test.each<[string, boolean, object, object, string[]]>([
		[
			"a mismatch outside its site",
			true,
			{ mismatches: [12, 28, 9] },
			{},
			[
				"primers[0].sites[0].mismatches[1]: must be inside its site",
				"primers[0].sites[0].mismatches[2]: must be inside its site",
			],
		],
		[
			"a mismatch outside a site across the origin",
			true,
			{ start: 95, end: 105, mismatches: [5, 94] },
			{},
			[
				"primers[0].sites[0].mismatches[0]: must be inside its site",
				"primers[0].sites[0].mismatches[1]: must be inside its site",
			],
		],
		[
			"a mismatch past the record",
			true,
			{ start: 95, end: 105, mismatches: [100] },
			{},
			[
				"primers[0].sites[0].mismatches[0]: must be less than the record's length, 100",
			],
		],
		[
			"a site wider than the primer",
			true,
			{ start: 0, end: 24 },
			{},
			[
				"primers[0].sites[0].end: must be at most start + 23, the primer's length",
			],
		],
		[
			"a site past a linear record",
			false,
			{ start: 95, end: 105 },
			{},
			["primers[0].sites[0].end: must be at most the record's length, 100"],
		],
		[
			"a strand that is not 1 or -1",
			true,
			{ strand: 0 },
			{},
			["primers[0].sites[0].strand: must be 1 or -1"],
		],
		[
			"bases that are not IUPAC letters",
			true,
			{},
			{ bases: "gatcaGTAAAA-GACGGCCAGTG" },
			[
				'primers[0].bases: has "-" at index 11, which is not an IUPAC nucleotide letter',
			],
		],
		[
			"keys a primer and a site do not have",
			true,
			{ tm: 60 },
			{ tail: "gatca" },
			["primers[0].sites[0].tm: unknown key", "primers[0].tail: unknown key"],
		],
	])("rejects %s", (_, isCircular, site, change, expected) => {
		expect(problems(record(isCircular, primers(site, change)))).toEqual(
			expected,
		);
	});
});

describe("cuts", () => {
	// EcoRI cuts G^AATTC, leaving a 4-base 5' overhang.
	const cut = { enzyme: "EcoRI", start: 10, end: 16, at: 11, stagger: 4 };
	const cuts = (change: object) => ({ cuts: [{ ...cut, ...change }] });
	const nearTheEnd = { start: 94, end: 100, at: 99 };

	test.each<[string, boolean, object]>([
		["a 5' overhang", false, {}],
		["a 3' overhang", false, { enzyme: "PstI", at: 15, stagger: -4 }],
		["a blunt cut", false, { enzyme: "EcoRV", at: 13, stagger: 0 }],
		["a cut by an enzyme with an empty name", false, { enzyme: "" }],
		["a site across the origin", true, { start: 98, end: 104, at: 99 }],
		["a bottom-strand cut past the origin", true, nearTheEnd],
	])("may make %s", (_, isCircular, change) => {
		expect(problems(record(isCircular, cuts(change)))).toEqual([]);
	});

	test.each<[string, boolean, object, string[]]>([
		[
			"a bottom-strand cut past a linear record's end",
			false,
			nearTheEnd,
			[
				"cuts[0].stagger: must keep at + stagger, the bottom-strand cut, at most the record's length, 100",
			],
		],
		[
			"a bottom-strand cut before a linear record's start",
			false,
			{ start: 0, end: 6, at: 1, stagger: -4 },
			[
				"cuts[0].stagger: must keep at + stagger, the bottom-strand cut, at 0 or more",
			],
		],
		[
			"a top-strand cut past a linear record's end",
			false,
			{ at: 101, stagger: 0 },
			["cuts[0].at: must be at most the record's length, 100"],
		],
		[
			"a top-strand cut at a circular record's length",
			true,
			{ at: 100 },
			[
				"cuts[0].at: must be less than the record's length, 100: on a circular record that point is 0",
			],
		],
		[
			"a stagger that is not a whole number",
			true,
			{ stagger: 0.5 },
			["cuts[0].stagger: must be an integer"],
		],
		[
			"an empty recognition sequence",
			true,
			{ end: 10 },
			["cuts[0].end: must be greater than start"],
		],
		[
			"keys a cut does not have",
			true,
			{ overhang: "AATT" },
			["cuts[0].overhang: unknown key"],
		],
	])("rejects %s", (_, isCircular, change, expected) => {
		expect(problems(record(isCircular, cuts(change)))).toEqual(expected);
	});
});

describe("insertions", () => {
	const insertion = { name: "attB1", at: 40, length: 25 };
	const insertions = (change: object) => ({
		insertions: [{ ...insertion, ...change }],
	});

	test.each<[string, boolean, object]>([
		["inside the record, with a color", true, { color: "#00ff00" }],
		["at the origin", true, { at: 0 }],
		["unnamed", true, { name: "" }],
		["at the end of a linear record", false, { at: 100, length: 1 }],
	])("may sit %s", (_, isCircular, change) => {
		expect(problems(record(isCircular, insertions(change)))).toEqual([]);
	});

	test.each<[string, boolean, object, string[]]>([
		[
			"no bases",
			true,
			{ length: 0 },
			["insertions[0].length: must be 1 or more"],
		],
		[
			"a point at a circular record's length",
			true,
			{ at: 100 },
			[
				"insertions[0].at: must be less than the record's length, 100: on a circular record that point is 0",
			],
		],
		[
			"a color not written #rrggbb",
			true,
			{ color: "green" },
			["insertions[0].color: must be a color written #rrggbb"],
		],
		[
			"keys an insertion does not have",
			true,
			{ bases: "ACGT" },
			["insertions[0].bases: unknown key"],
		],
	])("rejects %s", (_, isCircular, change, expected) => {
		expect(problems(record(isCircular, insertions(change)))).toEqual(expected);
	});
});

describe("reads", () => {
	const read = { name: "consensus.fasta", start: 10, end: 60, strand: 1 };
	const reads = (...changes: object[]) => ({
		reads: changes.map((change) => ({ ...read, ...change })),
	});
	const across = { start: 90, end: 110 };

	test("may run across the origin of a circular record, on either strand", () => {
		expect(
			problems(record(true, reads(across, { name: "r2", strand: -1 }))),
		).toEqual([]);
	});

	test.each<[string, boolean, object[], string[]]>([
		[
			"across a linear record's end",
			false,
			[across],
			["reads[0].end: must be at most the record's length, 100"],
		],
		[
			"on no strand",
			true,
			[{ strand: 0 }],
			["reads[0].strand: must be 1 or -1"],
		],
		[
			"two of one name",
			true,
			[{}, { start: 0, end: 5 }, { name: "consensus.fasta" }],
			[
				"reads[1].name: must differ from reads[0].name",
				"reads[2].name: must differ from reads[0].name",
			],
		],
		[
			"keys a read does not have",
			true,
			[{ color: "#cc3311" }],
			["reads[0].color: unknown key"],
		],
	])("rejects %s", (_, isCircular, changes, expected) => {
		expect(problems(record(isCircular, reads(...changes)))).toEqual(expected);
	});
});

describe("disagreements", () => {
	const reads = [
		{ name: "r1", start: 0, end: 60, strand: 1 },
		{ name: "r2", start: 50, end: 100, strand: -1 },
	];
	const substitution = {
		name: "41 A>G",
		start: 40,
		end: 41,
		bases: "G",
		reads: ["r1"],
	};
	const disagreements = (change: object) => ({
		reads,
		disagreements: [{ ...substitution, ...change }],
	});
	const point = { start: undefined, end: undefined, at: 55 };

	test.each<[string, object]>([
		["over a span, with a color", { color: "#CC3311" }],
		["over a span, as a deletion", { end: 43, bases: "" }],
		[
			"across the origin, shown by two reads",
			{ start: 95, end: 102, bases: "ACGTNNN", reads: ["r2", "r1"] },
		],
		["at a point, as an insertion", { ...point, bases: "TT" }],
		["at the origin", { ...point, at: 0, bases: "A" }],
		["shown by no read", { reads: [] }],
	])("may lie %s", (_, change) => {
		expect(problems(record(true, disagreements(change)))).toEqual([]);
	});

	test.each<[string, object, string[]]>([
		[
			"a span and a point",
			{ at: 40 },
			["disagreements[0].at: must not come with start or end"],
		],
		[
			"neither a span nor a point",
			{ start: undefined, end: undefined },
			["disagreements[0]: must have start and end, or at"],
		],
		[
			"a start with no end",
			{ end: undefined },
			["disagreements[0].end: missing"],
		],
		[
			"an empty span",
			{ end: 40 },
			["disagreements[0].end: must be greater than start"],
		],
		[
			"no bases at a point",
			{ ...point, bases: "" },
			["disagreements[0].bases: must hold at least one base at a point"],
		],
		[
			"bases that are not nucleotides",
			{ bases: "G-" },
			[
				'disagreements[0].bases: has "-" at index 1, which is not an IUPAC nucleotide letter',
			],
		],
		[
			"reads the record does not hold, by their exact names",
			{ reads: ["r1", "R2", "r3"] },
			[
				"disagreements[0].reads[1]: names no read in the record",
				"disagreements[0].reads[2]: names no read in the record",
			],
		],
		[
			"a color not written #rrggbb",
			{ color: "red" },
			["disagreements[0].color: must be a color written #rrggbb"],
		],
	])("rejects %s", (_, change, expected) => {
		expect(problems(record(true, disagreements(change)))).toEqual(expected);
	});

	test("lie within a linear record", () => {
		expect(
			problems(record(false, disagreements({ start: 95, end: 102 }))),
		).toEqual([
			"disagreements[0].end: must be at most the record's length, 100",
		]);
	});
});

describe("tracks", () => {
	const curve = [0, 3, 9, 3, 0, -1];
	const track = {
		name: "3730",
		curves: { A: curve, C: curve, G: curve, T: curve },
		// A bottom-strand read's bases descend as its samples ascend.
		peaks: [
			[2, 99],
			[4, 98],
		],
	};
	const tracks = (change: object) => ({ tracks: [{ ...track, ...change }] });
	const curves = (change: object) =>
		tracks({ curves: { ...track.curves, ...change } });

	test("may hold no samples", () => {
		const empty = { A: [], C: [], G: [], T: [] };
		expect(
			problems(record(false, tracks({ curves: empty, peaks: [] }))),
		).toEqual([]);
	});

	test.each<[string, object, string[]]>([
		["descending bases, and values below 0", tracks({}), []],
		[
			"a curve for a letter that is not A, C, G or T",
			curves({ N: curve }),
			["tracks[0].curves.N: unknown key"],
		],
		[
			"a curve left out",
			tracks({ curves: { A: curve, C: curve, G: curve } }),
			["tracks[0].curves.T: missing"],
		],
		[
			"curves of unequal length",
			curves({ C: [1], T: [...curve, 0] }),
			[
				"tracks[0].curves.C: must be as long as curves.A, 6 samples",
				"tracks[0].curves.T: must be as long as curves.A, 6 samples",
			],
		],
		[
			"a value that is not a finite number",
			curves({ G: [0, "3", 9, Number.POSITIVE_INFINITY, 0, 0] }),
			[
				"tracks[0].curves.G[1]: must be a number",
				"tracks[0].curves.G[3]: must be a finite number",
			],
		],
		[
			"samples that do not ascend",
			tracks({
				peaks: [
					[2, 10],
					[2, 11],
					[1, 12],
				],
			}),
			[
				"tracks[0].peaks[1][0]: must be greater than the previous peak's sample",
				"tracks[0].peaks[2][0]: must be greater than the previous peak's sample",
			],
		],
		[
			"a sample past the curves",
			tracks({ peaks: [[6, 10]] }),
			["tracks[0].peaks[0][0]: must be less than the curves' length, 6"],
		],
		[
			"a base past the record",
			tracks({ peaks: [[1, 100]] }),
			["tracks[0].peaks[0][1]: must be less than the record's length, 100"],
		],
		[
			"a peak that is not a pair of whole numbers",
			tracks({ peaks: [[1], [2.5, 3], [3, 4, 5]] }),
			[
				"tracks[0].peaks[0]: must be a pair, a sample and a base",
				"tracks[0].peaks[1][0]: must be an integer",
				"tracks[0].peaks[2]: must be a pair, a sample and a base",
			],
		],
	])("with %s", (_, kinds, expected) => {
		expect(problems(record(false, kinds))).toEqual(expected);
	});
});

describe("a record whose length or shape is malformed", () => {
	// Each kind holds one problem that needs no length, and one value that would break a rule
	// only a length could check.
	const kinds = {
		features: [
			{
				name: "a",
				type: "CDS",
				strand: 1,
				segments: [
					{ start: 50, end: 500 },
					{ start: 40, end: 45 },
				],
			},
		],
		primers: [
			{
				name: "b",
				bases: "ACGTACGTAC",
				sites: [{ start: 995, end: 1005, strand: 1, mismatches: [2, 1005] }],
			},
		],
		cuts: [{ enzyme: "c", start: 900, end: 906, at: 901, stagger: -1000 }],
		insertions: [{ name: "d", at: 5000, length: 0 }],
	};
	const ascend =
		"features[0].segments[1].start: must be greater than the previous segment's start";
	const outside = (i: number) =>
		`primers[0].sites[0].mismatches[${i}]: must be inside its site`;
	const bottom =
		"cuts[0].stagger: must keep at + stagger, the bottom-strand cut, at 0 or more";
	const empty = "insertions[0].length: must be 1 or more";

	test.each<[string, object, string[]]>([
		[
			// The feature's lower second start is where it runs off a linear record's end.
			"bases, on a linear record",
			{ circular: false, bases: 7 },
			["bases: must be text", outside(0), outside(1), bottom, empty],
		],
		[
			// Mismatch 2 may lie past the origin, inside a site that crosses it.
			"bases, on a circular record",
			{ circular: true, bases: "ACGU-" },
			[
				'bases: has "-" at index 4, which is not an IUPAC nucleotide letter',
				ascend,
				outside(1),
				empty,
			],
		],
		[
			"circular",
			{ circular: "no", bases: "ACGT" },
			["circular: must be true or false", ascend, outside(1), empty],
		],
	])(
		"with malformed %s reports what needs no length",
		(_, record, expected) => {
			expect(problems({ name: "p", ...record, ...kinds })).toEqual(expected);
		},
	);

	test("with lists that are not lists reports each", () => {
		expect(
			problems({
				name: "p",
				circular: true,
				features: 1,
				primers: {},
				cuts: "x",
				insertions: null,
			}),
		).toEqual([
			"bases: missing",
			"features: must be a list",
			"primers: must be a list",
			"cuts: must be a list",
			"insertions: must be a list",
		]);
	});
});

const circular: Bounds = { length: 2686, circular: true };
const linear: Bounds = { length: 2686, circular: false };

describe("span", () => {
	// A stand-in for a kind, so each problem is named by a nested path.
	const kind = (bounds: Bounds) =>
		v.strictObject({ segments: v.array(span(bounds)) });

	test.each<[string, Bounds, unknown, string[]]>([
		[
			"across the origin, on a circular record",
			circular,
			{ start: 2683, end: 2689 },
			[],
		],
		[
			"across the origin, on a linear record",
			linear,
			{ start: 2683, end: 2689 },
			["segments[0].end: must be at most the record's length, 2686"],
		],
		["the whole circular record", circular, { start: 0, end: 2686 }, []],
		["the whole linear record", linear, { start: 0, end: 2686 }, []],
		[
			"more than one turn",
			circular,
			{ start: 100, end: 2787 },
			["segments[0].end: must be at most start + 2686, one turn of the record"],
		],
		[
			"empty",
			circular,
			{ start: 5, end: 5 },
			["segments[0].end: must be greater than start"],
		],
		[
			"starting at the length",
			circular,
			{ start: 2686, end: 2690 },
			["segments[0].start: must be less than the record's length, 2686"],
		],
		[
			"starting below 0",
			linear,
			{ start: -1, end: 3 },
			["segments[0].start: must be 0 or more"],
		],
		[
			"not whole numbers",
			linear,
			{ start: 1.5, end: 3.5 },
			[
				"segments[0].start: must be an integer",
				"segments[0].end: must be an integer",
			],
		],
		[
			"not numbers",
			linear,
			{ start: "1", end: 3 },
			["segments[0].start: must be a number"],
		],
		[
			"past a linear record's length, with a start that is not a number",
			linear,
			{ start: "1", end: 99999 },
			[
				"segments[0].start: must be a number",
				"segments[0].end: must be at most the record's length, 2686",
			],
		],
		[
			"with keys a span does not have",
			linear,
			{ start: 0, end: 3, strand: 1, name: "a" },
			["segments[0].strand: unknown key", "segments[0].name: unknown key"],
		],
	])("%s", (_, bounds, segment, expected) => {
		expect(problems({ segments: [segment] }, kind(bounds))).toEqual(expected);
	});
});

describe("point", () => {
	const kind = (bounds: Bounds) => v.strictObject({ at: point(bounds) });

	test.each<[string, Bounds, number, string[]]>([
		["at the length, on a linear record", linear, 2686, []],
		[
			"at the length, on a circular record",
			circular,
			2686,
			[
				"at: must be less than the record's length, 2686: on a circular record that point is 0",
			],
		],
		["at the origin", circular, 0, []],
		[
			"past the length",
			linear,
			2687,
			["at: must be at most the record's length, 2686"],
		],
		["below 0", linear, -1, ["at: must be 0 or more"]],
		["not a whole number", linear, 4.5, ["at: must be an integer"]],
	])("%s", (_, bounds, at, expected) => {
		expect(problems({ at }, kind(bounds))).toEqual(expected);
	});
});

describe("base", () => {
	const kind = (bounds: Bounds) => v.strictObject({ at: base(bounds) });

	test.each<[string, Bounds, number, string[]]>([
		["the last base", circular, 2685, []],
		[
			"at the length",
			linear,
			2686,
			["at: must be less than the record's length, 2686"],
		],
		["below 0", circular, -1, ["at: must be 0 or more"]],
	])("%s", (_, bounds, at, expected) => {
		expect(problems({ at }, kind(bounds))).toEqual(expected);
	});
});
