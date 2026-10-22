/** A map's labels, the key of the item each names, the order they hide in, and their notice. */

import type { Face } from "./faces";
import type { Kind } from "./options";
import {
	DISAGREEMENT,
	INK,
	INSERTION,
	OUTLINE_WIDTH,
	PRIMER,
	painted,
	READ,
	shaded,
	textColor,
	unlit,
} from "./paint";
import { pointText, spanText } from "./pieces";
import type { Bounds, Disagreement, Insertion, Read, Span } from "./record";
import type { Box, Shape } from "./scene";
import { baseline, height, measure } from "./text";

/** A label's size of text, and the small text of a map's ruler, title and notice. */
export const LABEL_SIZE = 11.5;
export const SMALL_SIZE = 10.5;

/** The room around text: either side of it, and above and below it. */
export const PAD_X = 3;
export const PAD_Y = 1;

/** The room between a drawing and what is set beside it: its labels, title and notice. */
export const GAP = 10;

/** The least room between two labels' boxes. */
export const SPACING = 2;

/** The kinds a map labels: all but tracks. */
export type LabelKind = Exclude<Kind, "tracks">;

/** The kinds whose items lie at a point between two bases; a disagreement may lie at either. */
type AtPoint = "cuts" | "insertions" | "disagreements";

/**
 * A label left out because it would overlap: a feature's, primer's, read's or disagreement's by
 * the spans it belongs to, a cut site's, insertion's or disagreement's by its point, as the record
 * writes it.
 */
export type Hidden =
	| {
			readonly kind: Exclude<LabelKind, "cuts" | "insertions">;
			readonly name: string;
			readonly spans: readonly Span[];
	  }
	| { readonly kind: AtPoint; readonly name: string; readonly at: number };

declare const KEY: unique symbol;

/** The key an item is known by in every view: the item as text, as `itemKey` writes it. */
export type ItemKey = string & { readonly [KEY]: true };

/** The key `item` is known by in every view. */
export function itemKey(item: Hidden): ItemKey {
	const { kind, name } = item;
	return JSON.stringify(
		"at" in item
			? { kind, name, at: item.at }
			: {
					kind,
					name,
					spans: item.spans.map(({ start, end }) => ({ start, end })),
				},
	) as ItemKey;
}

/** A stretch of a label's text in one face. */
export interface Run {
	readonly text: string;
	readonly face: Face;
}

/**
 * One label: what it names, its text, and what decides when it hides. Every label of one item is
 * one `Label`.
 */
export type Label = Hidden & {
	/** Its text, in runs set side by side. */
	readonly runs: readonly Run[];
	/** A feature's box, or any other label's text. */
	readonly color: string;
	/** Whether a highlight leaves it unlit. */
	readonly dim: boolean;
	/** For a cut site, the fewest times one of its enzymes cuts the record; else 0. */
	readonly fewestCuts: number;
	/** What a live page's hover box says of the item. */
	readonly tip: string;
};

/** An item's tip: its name, type and span, then its length in bases if it has one. */
export function tipOf(
	name: string,
	type: string,
	span: string,
	length?: number,
): string {
	return [
		name,
		type,
		span,
		...(length === undefined ? [] : [`${length} bp`]),
	].join("\n");
}

/** `shapes`, each carrying the tip and the key of `label`, the item they draw. */
export function itemShapes(shapes: readonly Shape[], label: Label): Shape[] {
	const { tip } = label;
	const item = itemKey(label);
	return shapes.map((shape) => ({ ...shape, tip, item }));
}

/**
 * The label of `item` that says `runs` in `color`, with the item's `tip`, dimmed to one grey when
 * `highlight` names something but none of `names`. Only a cut site's label passes `fewestCuts`.
 */
export function labelOf(
	item: Hidden,
	runs: readonly Run[],
	tip: string,
	color: string,
	highlight: readonly string[],
	{
		names = [item.name],
		fewestCuts = 0,
	}: { names?: readonly string[]; fewestCuts?: number } = {},
): Label {
	const dim = unlit(highlight, names);
	return { ...item, runs, color: painted(color, dim), dim, fewestCuts, tip };
}

/** The label of a primer named `name` at the site `span`: its name and the bases it spans. */
export function primerLabel(
	name: string,
	span: Span,
	length: number,
	highlight: readonly string[],
): Label {
	return siteLabel("primers", name, span, length, PRIMER, highlight);
}

/** The label of `read`: its name and the bases it spans. */
export function readLabel(
	read: Read,
	length: number,
	highlight: readonly string[],
): Label {
	return siteLabel("reads", read.name, read, length, READ, highlight);
}

function siteLabel(
	kind: "primers" | "reads",
	name: string,
	{ start, end }: Span,
	length: number,
	color: string,
	highlight: readonly string[],
): Label {
	const span = spanText({ start, end }, length);
	return labelOf(
		{ kind, name, spans: [{ start, end }] },
		[{ text: `${name} (${span})`, face: "sans" }],
		tipOf(name, kind === "primers" ? "primer" : "read", span, end - start),
		color,
		highlight,
	);
}

/** The label of `insertion`, what it adds, and its hover: its name and point. */
export function insertionLabel(
	insertion: Insertion,
	bounds: Bounds,
	highlight: readonly string[],
): { label: Label; hover: string } {
	const { name, at } = insertion;
	return hovered(
		{ kind: "insertions", name, at },
		`+${insertion.length} bp`,
		insertion.color ?? INSERTION,
		pointText(at, bounds),
		insertion.length,
		highlight,
	);
}

/** The label of `disagreement`, its name, and its hover: its name and where it lies. */
export function disagreementLabel(
	disagreement: Disagreement,
	bounds: Bounds,
	highlight: readonly string[],
): { label: Label; hover: string } {
	const { name } = disagreement;
	const [item, where, bases]: [Hidden, string, number?] =
		disagreement.at === undefined
			? [
					{
						kind: "disagreements",
						name,
						spans: [{ start: disagreement.start, end: disagreement.end }],
					},
					spanText(disagreement, bounds.length),
					disagreement.end - disagreement.start,
				]
			: [
					{ kind: "disagreements", name, at: disagreement.at },
					pointText(disagreement.at, bounds),
				];
	return hovered(
		item,
		name,
		disagreement.color ?? DISAGREEMENT,
		where,
		bases,
		highlight,
	);
}

/**
 * The label of `item` saying `text` in `color`, with its tip, and its hover: its name and `where`
 * it lies. An item `bases` long says so in its tip.
 */
function hovered(
	item: Hidden,
	text: string,
	color: string,
	where: string,
	bases: number | undefined,
	highlight: readonly string[],
): { label: Label; hover: string } {
	const type = item.kind === "insertions" ? "insertion" : "disagreement";
	const label = labelOf(
		item,
		[{ text, face: "sans" }],
		tipOf(item.name, type, where, bases),
		color.toLowerCase(),
		highlight,
	);
	const hover = [item.name.trim(), where].filter(Boolean).join(" · ");
	return { label, hover };
}

/** The radius of a box's corners. */
const CORNER = 2;

/** The box `label` takes, its text padded. */
export function labelSize(label: Label): { width: number; height: number } {
	const width = label.runs.reduce(
		(sum, run) => sum + measure(run.text, run.face, LABEL_SIZE),
		0,
	);
	return {
		width: width + 2 * PAD_X,
		height: height("sans", LABEL_SIZE) + 2 * PAD_Y,
	};
}

/**
 * `label` drawn in `box`, which `labelSize` sized: a feature's name, or a disagreement's over a
 * span, in a box of its colour; any other label as text in its colour.
 */
export function labelShapes(label: Label, box: Box): Shape[] {
	const boxed =
		label.kind === "features" ||
		(label.kind === "disagreements" && "spans" in label);
	const shapes: Shape[] = boxed
		? [
				{
					shape: "rect",
					...box,
					corner: CORNER,
					fill: label.color,
					stroke: shaded(label.color),
					strokeWidth: OUTLINE_WIDTH,
				},
			]
		: [];
	const y = baseline("sans", LABEL_SIZE, box.y + box.height / 2);
	let x = box.x + PAD_X;
	for (const { text, face } of label.runs) {
		shapes.push({
			shape: "text",
			text,
			face,
			size: LABEL_SIZE,
			x,
			y,
			anchor: "start",
			fill: boxed ? textColor(label.color) : label.color,
		});
		x += measure(text, face, LABEL_SIZE);
	}
	return shapes;
}

/** Each kind's place in the order labels hide, first to hide first. */
const HIDING: { readonly [K in LabelKind]: number } = {
	cuts: 0,
	primers: 1,
	reads: 2,
	features: 3,
	insertions: 4,
	disagreements: 5,
};

/** What the notice calls one label of each kind. */
const WORDS: { readonly [K in LabelKind]: string } = {
	cuts: "cut site",
	primers: "primer",
	reads: "read",
	features: "feature",
	insertions: "insertion",
	disagreements: "disagreement",
};

/**
 * Sort labels by this, first to hide first: dimmed before lit, then by kind as `HIDING` orders
 * them, then the enzymes that cut most, then the longest text. Ties keep their order.
 */
export function hidingOrder(a: Label, b: Label): number {
	const key = (label: Label) => [
		label.dim ? 0 : 1,
		HIDING[label.kind],
		-label.fewestCuts,
		-textOf(label).length,
	];
	const [first, second] = [key(a), key(b)];
	for (const [i, value] of first.entries()) {
		if (value !== second[i]) return value - second[i];
	}
	return 0;
}

/** `label` as a drawing lists it once it hides. */
export function hiddenOf(label: Label): Hidden {
	const { name } = label;
	return "at" in label
		? { kind: label.kind, name, at: label.at }
		: { kind: label.kind, name, spans: label.spans };
}

/** All of a label's text. */
function textOf(label: Label): string {
	return label.runs.map((run) => run.text).join("");
}

/**
 * The hidden-label notice: how many labels of each kind hid, as "3 cut sites and 1 primer are
 * hidden", or nothing when none did.
 */
export function notice(
	hidden: readonly { readonly kind: LabelKind }[],
): string {
	const kinds = (Object.keys(HIDING) as LabelKind[]).sort(
		(a, b) => HIDING[a] - HIDING[b],
	);
	const parts = kinds.flatMap((kind) => {
		const word = WORDS[kind];
		const n = hidden.filter((one) => one.kind === kind).length;
		return n ? [`${n} ${n === 1 ? word : `${word}s`}`] : [];
	});
	if (!parts.length) return "";
	const last = parts.pop();
	const listed = parts.length ? `${parts.join(", ")} and ${last}` : last;
	return `${listed} ${hidden.length === 1 ? "is" : "are"} hidden`;
}

/**
 * The notice set `GAP` under the corner (`right`, `bottom`) of what a drawing covers, ending at
 * `right`, with each hidden label on a line of its hover, and of its tip under the notice itself;
 * nothing when none hid.
 */
export function noticeShapes(
	hidden: readonly Label[],
	right: number,
	bottom: number,
): Shape[] {
	const text = notice(hidden);
	if (!text) return [];
	const middle = bottom + GAP + height("sans", SMALL_SIZE) / 2;
	return [
		{
			shape: "text",
			text,
			face: "sans",
			size: SMALL_SIZE,
			x: right - measure(text, "sans", SMALL_SIZE),
			y: baseline("sans", SMALL_SIZE, middle),
			anchor: "start",
			fill: INK,
			title: hidden.map(textOf).join("\n"),
			tip: [text, ...hidden.map(textOf)].join("\n"),
		},
	];
}
