/**
 * The sequence view's pane in a record's frame: its bar stuck at its top, then the view, beside
 * the map or under it, its rows fitted to the room or as given, keeping the row the reader
 * scrolled to at its top.
 */

import type { Options } from "../format/options";
import type { Record } from "../format/record";
import type { Box } from "../scene";
import type { RowBox } from "../sequence/row";
import { layoutSequence, type SequenceScene } from "../sequence/view";
import { inPoints, toElement } from "../svg";
import { type Arrangement, arrange } from "./arrange";
import { rowBase, rowHolding } from "./geometry";
import { hoverBox } from "./hover";

/** The class of a pane showing the top strand alone. */
export const ONE_STRAND = "one-strand";

/** The class of a frame showing the sequence view beside its map. */
export const BESIDE = "beside";

/** The room between a map and the sequence view beside it, in CSS pixels. */
export const VIEWS_APART = 24;

/** The sequence view as a frame shows it: its drawing on the page, and its rows. */
export interface SequenceShown {
	readonly svg: SVGSVGElement;
	readonly rows: readonly RowBox[];
}

/** A place on the page, in client pixels. */
export type ClientPoint = Pick<PointerEvent, "clientX" | "clientY">;

/** The sequence view's pane in a frame. */
export interface Pane {
	/** The pane, no taller than the window, scrolling the sequence view under its bar. */
	readonly element: HTMLElement;
	/** The pane's bar, stuck at its top. */
	readonly bar: HTMLFormElement;
	/** The sequence view as shown, or null while it is off or absent. */
	shown(): SequenceShown | null;
	/**
	 * Show the sequence view as the options say, beside a map `map` CSS pixels wide at 1× or
	 * under it, as the room allows or, `printing`, under at full size with rows as a file's; drawn
	 * again only for another row length or other options it reads, and each row length laid out
	 * once for the options. With `still`, as a circle turns, it stays where it sits. Returns
	 * whether it was drawn anew.
	 */
	arrange(
		map: number,
		how?: { readonly still?: boolean; readonly printing?: boolean },
	): boolean;
	/** The room the map has, in CSS pixels: the frame's, less the sequence view's beside it. */
	mapRoom(): number;
	/** Show both strands, or the top one alone, as the options say. Nothing moves. */
	showStrands(): void;
	/** The base of the sequence view at `at`, or with `near` the nearest; null off its strands. */
	sequenceBase(at: ClientPoint, near?: boolean): number | null;
}

/** The sequence view as drawn in a pane: the options it read, and how many bases a row holds. */
interface SequenceDrawn extends SequenceShown {
	readonly for: string;
	readonly perRow: number;
	readonly extent: Box;
}

/**
 * The sequence view's pane of `record` for the frame `root`, drawing it as `options` say each
 * time it is asked. A hover over a base says its position.
 */
export function openPane(
	root: HTMLElement,
	record: Record,
	options: () => Options,
): Pane {
	const document = root.ownerDocument;
	const element = document.createElement("div");
	element.className = "sequence";
	const bar = document.createElement("form");
	bar.className = "bar";
	bar.autocomplete = "off";
	element.append(bar);

	let drawn: SequenceDrawn | null = null;
	/** Where the sequence view sits while it shows. */
	let arranged: Arrangement | null = null;
	/** The view laid out for the options it last read, by how many bases a row holds. */
	let laid = { for: "", by: new Map<number, SequenceScene>() };
	const scale = () => arranged?.scale ?? 1;
	/** The first base of the pane's top row, as the reader's scrolling last left it. */
	let heading: number | null = null;

	/** How wide the pane's scroll bar is, where it takes room. */
	const gutter = () => element.offsetWidth - element.clientWidth;

	/** The top row in sight: the first whose rail lies below the pane's bar. */
	const topRow = (): RowBox | null => {
		if (drawn === null) return null;
		const { rows, extent } = drawn;
		// The bar is stuck at the pane's top, over the drawing's first `scrollTop` pixels.
		const y = extent.y + element.scrollTop / scale();
		return rows.find((row) => row.strands.rail > y) ?? rows.at(-1) ?? null;
	};
	/** Scroll the pane so the row holding the heading is its top row, unless it is already. */
	const keepHeading = () => {
		const top = topRow();
		if (heading === null || drawn === null || top === null) return;
		const { rows, extent } = drawn;
		const row = rowHolding(rows, heading);
		if (row === null || row === top) return;
		element.scrollTop = row === rows[0] ? 0 : (row.y - extent.y) * scale();
	};
	element.addEventListener("scroll", () => {
		const top = topRow();
		if (top === null || drawn === null) return;
		if (heading === null || rowHolding(drawn.rows, heading) !== top) {
			heading = top.start;
		}
	});

	const shown = () => (element.hidden ? null : drawn);
	const sequenceBase = (at: ClientPoint, near = false): number | null => {
		const sequence = shown();
		const point = sequence && inPoints(sequence.svg, at);
		if (!sequence || !point) return null;
		const bottom = options().bottom_strand;
		return rowBase(sequence.rows, point[0], point[1], { near, bottom });
	};
	/** What the hover box says over a base: its position. */
	const position = (event: PointerEvent) => {
		const base = sequenceBase(event);
		return base === null
			? null
			: `position ${(base % record.bases.length) + 1}`;
	};
	const showStrands = () => {
		element.classList.toggle(ONE_STRAND, !options().bottom_strand);
	};

	return {
		element,
		bar,
		shown,
		arrange: (map, { still = false, printing = false } = {}) => {
			const given = options();
			element.hidden = !given.sequence_view;
			showStrands();
			if (!given.sequence_view) {
				arranged = null;
				root.classList.remove(BESIDE);
				return false;
			}
			const key = sequenceKey(given);
			if (laid.for !== key) laid = { for: key, by: new Map() };
			const { by } = laid;
			const sceneOf = (perRow: number) => {
				const scene = by.get(perRow) ?? paneLayout(record, given, perRow);
				by.set(perRow, scene);
				return scene;
			};
			const viewWidth = (perRow: number) => sceneOf(perRow).extent.width;
			// A print lays the view out as before the page has a width.
			const room = printing ? 0 : root.clientWidth - gutter();
			const next =
				still && arranged !== null
					? arranged
					: arrange(
							room,
							VIEWS_APART,
							{ map, view: viewWidth },
							given.bases_per_row,
						);
			const { perRow } = next;
			const anew = drawn?.for !== key || drawn.perRow !== perRow;
			const rescaled = next.scale !== scale();
			arranged = next;
			root.classList.toggle(BESIDE, next.place === "beside");
			if (anew || drawn === null) {
				const scene = sceneOf(perRow);
				const svg = toElement(scene, document);
				if (drawn) drawn.svg.replaceWith(svg);
				else element.append(svg);
				hoverBox(svg, position);
				const { rows, extent } = scene;
				drawn = { for: key, perRow, svg, rows, extent };
			}
			const { svg, extent } = drawn;
			const px = (points: number) =>
				next.scale === 1 ? "" : `${points * next.scale}px`;
			svg.style.width = px(extent.width);
			svg.style.height = px(extent.height);
			if (anew || rescaled) keepHeading();
			return anew;
		},
		mapRoom: () =>
			arranged?.place === "beside" && drawn !== null
				? root.clientWidth -
					VIEWS_APART -
					drawn.extent.width * arranged.scale -
					gutter()
				: root.clientWidth,
		showStrands,
		sequenceBase,
	};
}

/** What of `options` the sequence view in a pane reads, as text. */
function sequenceKey(options: Options): string {
	return JSON.stringify({
		...options,
		bottom_strand: true,
		map: null,
		sequence_view: null,
	});
}

/** The sequence view laid out for a pane, with both strands, in rows of `perRow` bases. */
function paneLayout(
	record: Record,
	options: Options,
	perRow: number,
): SequenceScene {
	return layoutSequence(record, {
		...options,
		bottom_strand: true,
		bases_per_row: perRow,
	});
}
