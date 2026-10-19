/** A map's labels, the order they hide in, and the notice that counts them. */

import { INK, OUTLINE_WIDTH, painted, shaded, textColor, unlit } from "./paint";
import type { Span } from "./record";
import type { Box, Scene, Shape } from "./scene";
import { baseline, type Face, height, measure } from "./text";

/** A label's size of text, and the small text of a map's ruler, title and notice. */
export const LABEL_SIZE = 11.5;
export const SMALL_SIZE = 10.5;

/** The room around text: either side of it, and above and below it. */
export const PAD_X = 3;
export const PAD_Y = 1;

/** The room between a drawing and what is set beside it: its labels, title and notice. */
export const GAP = 10;

/** Each kind a record holds, by its list's key in the record. */
export const KINDS = ["features", "primers", "cuts", "insertions"] as const;

export type Kind = (typeof KINDS)[number];

/** A label left out because it would overlap. */
export interface Hidden {
	readonly kind: Kind;
	readonly name: string;
	/** The spans the label belongs to. */
	readonly spans: readonly Span[];
}

/** A map laid out, and the labels it left out. */
export interface MapScene extends Scene {
	readonly hidden: readonly Hidden[];
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
export interface Label extends Hidden {
	/** Its text, in runs set side by side. */
	readonly runs: readonly Run[];
	/** A feature's box, or any other label's text. */
	readonly color: string;
	/** Whether a highlight leaves it unlit. */
	readonly dim: boolean;
	/** For a cut site, the fewest times one of its enzymes cuts the record; else 0. */
	readonly fewestCuts: number;
}

/**
 * The label of `item` that says `runs` in `color`, dimmed to one grey when `highlight` names
 * something but none of `names`. Only a cut site's label passes `fewestCuts`.
 */
export function labelOf(
	item: Hidden,
	runs: readonly Run[],
	color: string,
	highlight: readonly string[],
	{
		names = [item.name],
		fewestCuts = 0,
	}: { names?: readonly string[]; fewestCuts?: number } = {},
): Label {
	const dim = unlit(highlight, names);
	return { ...item, runs, color: painted(color, dim), dim, fewestCuts };
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
 * `label` drawn in `box`, which `labelSize` sized: a feature's name in a box of its colour, any
 * other label as text in its colour.
 */
export function labelShapes(label: Label, box: Box): Shape[] {
	const boxed = label.kind === "features";
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
const HIDING: { readonly [K in Kind]: number } = {
	cuts: 0,
	primers: 1,
	features: 2,
	insertions: 3,
};

/** What the notice calls one label of each kind. */
const WORDS: { readonly [K in Kind]: string } = {
	cuts: "cut site",
	primers: "primer",
	features: "feature",
	insertions: "insertion",
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
export function hiddenOf({ kind, name, spans }: Label): Hidden {
	return { kind, name, spans };
}

/** All of a label's text. */
function textOf(label: Label): string {
	return label.runs.map((run) => run.text).join("");
}

/**
 * The hidden-label notice: how many labels of each kind hid, as "3 cut sites and 1 primer are
 * hidden", or nothing when none did.
 */
export function notice(hidden: readonly { readonly kind: Kind }[]): string {
	const kinds = [...KINDS].sort((a, b) => HIDING[a] - HIDING[b]);
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
 * `right`, with each hidden label on a line of its hover; nothing when none hid.
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
			hover: hidden.map(textOf).join("\n"),
		},
	];
}
