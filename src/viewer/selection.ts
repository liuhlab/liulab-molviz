/** What a page has selected, as data: from a click on an item or a drag, and what it says. */

import { folded } from "./format";
import { type Hidden, type ItemKey, itemKey } from "./labels";
import { hulls, pointText, spansText, turns } from "./pieces";
import { type Bounds, type Record, recordBounds, type Span } from "./record";

/** An item a reader may select, as its label lists it once it hides. */
export type Item = Hidden;

/** The kinds of item over spans, and at a point. */
const OVER_SPANS = new Set(["features", "primers", "reads", "disagreements"]);
const AT_POINT = new Set(["cuts", "insertions", "disagreements"]);

/** Whether `read` is an item, as its key holds one. */
function isItem(read: unknown): read is Item {
	if (typeof read !== "object" || read === null) return false;
	const { kind, name, spans, at, ...rest } = read as { [key: string]: unknown };
	if (typeof kind !== "string" || typeof name !== "string") return false;
	if (Object.keys(rest).length) return false;
	if (spans === undefined) return AT_POINT.has(kind) && typeof at === "number";
	return (
		at === undefined &&
		OVER_SPANS.has(kind) &&
		Array.isArray(spans) &&
		spans.every(
			(span) =>
				typeof span?.start === "number" && typeof span?.end === "number",
		)
	);
}

/**
 * Bases selected, as spans in reading order, each in the record's counting; or an item's point
 * between two bases. `item` is the key of the item clicked, or null for a drag.
 */
export type Selection =
	| { readonly spans: readonly Span[]; readonly item: ItemKey | null }
	| { readonly at: number; readonly item: ItemKey };

/** The item `key` names; throws if it names none. */
function itemOf(key: string): Item {
	let read: unknown;
	try {
		read = JSON.parse(key);
	} catch {
		read = undefined;
	}
	if (!isItem(read)) throw new Error(`${key} names no item`);
	return read;
}

/**
 * What a click on the item `key` names selects in `record`, with `enzymes` on. Throws if `key`
 * names no item.
 */
export function itemSelection(
	key: string,
	record: Record,
	enzymes: readonly string[],
): Selection {
	const item = itemOf(key);
	const keyed = itemKey(item);
	const bounds = recordBounds(record);
	if ("spans" in item) return { spans: hulls(item.spans, bounds), item: keyed };
	if (item.kind !== "cuts") return { at: item.at, item: keyed };
	const on = new Set(enzymes.map(folded));
	const made = record.cuts.filter(
		(cut) => cut.at === item.at && on.has(folded(cut.enzyme)),
	);
	return { spans: [recognised(made, bounds)], item: keyed };
}

/**
 * From the first of a cut site's recognition spans to the last, each taken a turn either way
 * where that brings it nearest the first.
 */
function recognised(spans: readonly Span[], bounds: Bounds): Span {
	const first = spans[0].start;
	const near = spans.map(({ start, end }) => {
		const [shift] = turns(bounds).sort(
			(a, b) => Math.abs(start + a - first) - Math.abs(start + b - first),
		);
		return { start: start + shift, end: end + shift };
	});
	return startInside(
		{
			start: Math.min(...near.map(({ start }) => start)),
			end: Math.max(...near.map(({ end }) => end)),
		},
		bounds,
	);
}

/** `span` moved a turn, if it must be, to start inside the record. */
function startInside({ start, end }: Span, { length, circular }: Bounds): Span {
	const shift = circular ? Math.floor(start / length) * length : 0;
	return { start: start - shift, end: end - shift };
}

/**
 * What a click leaves selected: `picked`, the clicked item's selection, or nothing when it is
 * the item already selected or the click was on no item.
 */
export function clicked(
	selection: Selection | null,
	picked: Selection | null,
): Selection | null {
	return picked && picked.item !== selection?.item ? picked : null;
}

/**
 * A drag across bases: the base pressed, the base the pointer is over, and how far it has gone
 * from the first to the second, back being negative. Bases are counted as the view counts them.
 */
export interface Drag {
	readonly anchor: number;
	readonly over: number;
	readonly travel: number;
}

/** A drag pressed on `base`. */
export function dragFrom(base: number): Drag {
	return { anchor: base, over: base, travel: 0 };
}

/** `drag` along a line or the rows, the pointer now over `base`. */
export function dragTo(drag: Drag, base: number): Drag {
	return { ...drag, over: base, travel: base - drag.anchor };
}

/**
 * `drag` around a circle of `length` bases, the pointer now over `base`. It went the shorter way
 * round from the base before, so it may run past the origin, and past a full turn.
 */
export function turnTo(drag: Drag, base: number, length: number): Drag {
	const ahead = (((base - drag.over) % length) + length) % length;
	const step = ahead > length / 2 ? ahead - length : ahead;
	return { ...drag, over: base, travel: drag.travel + step };
}

/**
 * The bases `drag` selects, from the base pressed to the base under the pointer: the whole
 * record once it has gone a full turn.
 */
export function dragged({ anchor, travel }: Drag, bounds: Bounds): Selection {
	const span =
		Math.abs(travel) + 1 >= bounds.length
			? { start: 0, end: bounds.length }
			: travel < 0
				? { start: anchor + travel, end: anchor + 1 }
				: { start: anchor, end: anchor + travel + 1 };
	return { spans: [startInside(span, bounds)], item: null };
}

/**
 * Where a view shows `selection`: its spans, or a point by the base before it, which on a circle
 * is the last base at the origin, and on a linear record the first at its start.
 */
export function shownAt(selection: Selection, bounds: Bounds): readonly Span[] {
	if ("spans" in selection) return selection.spans;
	const start = bounds.circular
		? selection.at - 1
		: Math.max(selection.at - 1, 0);
	return [{ start, end: start + 1 }];
}

/** The top strand's bases `selection` holds, in reading order; none at a point. */
export function copied(selection: Selection, bases: string): string {
	if (!("spans" in selection)) return "";
	const { length } = bases;
	return selection.spans
		.map(({ start, end }) =>
			end > length
				? bases.slice(start) + bases.slice(0, end - length)
				: bases.slice(start, end),
		)
		.join("");
}

/**
 * How many characters the longest caption a selection in `record` can have holds: its numbers
 * as long as the record's length, and as many spans as a feature across a linear end selects.
 */
export function captionRoom(record: Record): number {
	const bounds = recordBounds(record);
	const number = "0".repeat(String(bounds.length).length);
	const parts = record.features.map(
		({ segments }) => hulls(segments, bounds).length,
	);
	const span = `${number} .. ${number}`;
	const spans = Array.from({ length: Math.max(1, ...parts) }, () => span);
	return `${spans.join(", ")} (${number} bp)`.length;
}

/** `selection` as its caption says it: `151 .. 276 (126 bp)`. */
export function caption(selection: Selection, bounds: Bounds): string {
	if (!("spans" in selection)) return pointText(selection.at, bounds);
	const { spans } = selection;
	const count = spans.reduce((sum, { start, end }) => sum + end - start, 0);
	return `${spansText(spans, bounds.length)} (${count} bp)`;
}
