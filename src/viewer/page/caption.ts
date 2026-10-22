/** A frame's caption: what the reader selected, with Copy, and a copy by the keys. */

import { recordBounds } from "../format/record";
import { type Frame, fieldset } from "./frame";
import { caption, captionRoom, copied, type Selection } from "./selection";

/** What a copy by the keys reads: the frame selected in last, and whether its Copy is copying. */
interface Copier {
	frame: Frame | null;
	button: boolean;
}

/** Each page's copier, once a frame on it has a caption. */
const copiers = new WeakMap<Document, Copier>();

/**
 * Say `frame`'s selection in a caption with Copy: in the pane's bar while the sequence view
 * shows, else in the frame's bar after Reset. What says nothing hides with its room kept, so that
 * nothing moves.
 */
export function addCaption(frame: Frame): void {
	const { record, state, bar, paneBar } = frame;
	const bounds = recordBounds(record);
	const document = bar.ownerDocument;
	const window = document.defaultView;
	const copier = copyKeys(document);

	const output = document.createElement("output");
	output.style.minWidth = `${captionRoom(record)}ch`;
	const copy = document.createElement("button");
	copy.type = "button";
	copy.textContent = "Copy";
	const said = fieldset(document, "Selection", [output, copy], "selection");
	const room = (element: HTMLElement, shown: unknown) => {
		element.style.visibility = shown ? "" : "hidden";
	};

	let last: Selection | null = null;
	const say = () => {
		const { selection } = state;
		if (selection !== null && selection !== last) copier.frame = frame;
		last = selection;
		room(said, selection);
		output.textContent = selection ? caption(selection, bounds) : "";
		room(copy, selection && "spans" in selection);
		const home = frame.sequence()
			? paneBar
			: (bar.querySelector(".end") ?? bar);
		if (said.parentElement !== home) home.append(said);
	};
	frame.onChange(say);
	say();

	copy.addEventListener("click", () => {
		const text = state.selection ? copied(state.selection, record.bases) : "";
		if (!text) return;
		copier.frame = frame;
		// Without the clipboard, as on a page not served securely, the copy event takes it.
		const byEvent = () => {
			copier.button = true;
			document.execCommand?.("copy");
			copier.button = false;
		};
		const clipboard = window?.navigator.clipboard;
		if (clipboard) clipboard.writeText(text).catch(byEvent);
		else byEvent();
	});
}

/**
 * Let a copy by the keys or the Edit menu on `document` take the bases of the frame selected in
 * last, unless the page has text selected and its Copy button is not copying. Returns what the
 * copy reads, for each frame to set.
 */
function copyKeys(document: Document): Copier {
	const kept = copiers.get(document);
	if (kept) return kept;
	const copier: Copier = { frame: null, button: false };
	copiers.set(document, copier);
	document.addEventListener("copy", (event) => {
		const { frame, button } = copier;
		const selection = frame?.box.isConnected ? frame.state.selection : null;
		const text = selection ? copied(selection, frame?.record.bases ?? "") : "";
		if (!text) return;
		if (!button && document.getSelection()?.isCollapsed === false) return;
		event.clipboardData?.setData("text/plain", text);
		event.preventDefault();
	});
	return copier;
}
