/** A record's switches in its frame's bar: each kind it holds, each feature type and each enzyme. */

import { byName, cutCounts } from "./cuts";
import { folded } from "./format";
import type { Frame } from "./frame";
import { KINDS, type Kind } from "./labels";

/** What a kind's switch says, where that is not its key capitalised. */
const SAID: { readonly [K in Kind]?: string } = { cuts: "Cut sites" };

/** The kinds only the sequence view draws, whose switches show only with it. */
const SEQUENCE_ONLY: ReadonlySet<string> = new Set(["tracks"]);

/**
 * Add `frame`'s switches at the left of its bar, each ticked as the frame's options start: the
 * kinds the record holds, its feature types, and its enzymes folded in a list. A change sets the
 * options and lays the frame out again.
 */
export function switches(frame: Frame): void {
	const { record, bar } = frame;
	const document = bar.ownerDocument;
	const { kinds_off, types_off, enzymes } = frame.state.options;
	const make = (name: string, value: string, on: boolean, ...text: Content[]) =>
		checkbox(document, name, value, on, ...text);

	const held = KINDS.filter((kind) => record[kind].length > 0).map(
		(kind) =>
			[
				kind,
				make("kind", kind, !kinds_off.includes(kind), said(kind)),
			] as const,
	);
	const kinds = fieldset(
		document,
		"Kinds",
		held.map(([, label]) => label),
	);
	const types = fieldset(
		document,
		"Feature types",
		[...new Set(record.features.map(({ type }) => type))]
			.sort(byName)
			.map((type) => make("type", type, !types_off.includes(type), type)),
	);
	const counts = cutCounts(record);
	const on = new Set(enzymes.map(folded));
	const list = fieldset(
		document,
		"Enzymes",
		[...counts.keys()].sort(byName).map((enzyme) => {
			const n = counts.get(enzyme);
			const name = n === 1 ? bold(document, enzyme) : enzyme;
			return make("enzyme", enzyme, on.has(folded(enzyme)), name, ` (${n})`);
		}),
	);
	const summary = document.createElement("summary");
	const folding = document.createElement("details");
	folding.append(summary, list);

	const ticked = () => [
		...list.querySelectorAll<HTMLInputElement>("input:checked"),
	];
	const refresh = () => {
		const { kinds_off, sequence_view } = frame.state.options;
		summary.textContent = `Enzymes (${ticked().length} of ${counts.size})`;
		list.disabled = kinds_off.includes("cuts");
		types.disabled = kinds_off.includes("features");
		for (const [kind, label] of held) {
			label.hidden = SEQUENCE_ONLY.has(kind) && !sequence_view;
		}
	};
	refresh();
	bar.prepend(
		...[kinds, types].filter((set) => set.elements.length),
		...(counts.size ? [folding] : []),
	);

	bar.addEventListener("change", (event) => {
		const { name, value, checked } = event.target as HTMLInputElement;
		const options = frame.state.options;
		const toggled = <T extends string>(off: readonly T[]) =>
			checked ? off.filter((one) => one !== value) : [...off, value as T];
		const changed =
			name === "kind"
				? { kinds_off: toggled(options.kinds_off) }
				: name === "type"
					? { types_off: toggled(options.types_off) }
					: name === "enzyme"
						? { enzymes: ticked().map((one) => one.value) }
						: null;
		if (changed !== null) {
			frame.state.options = { ...options, ...changed };
			frame.redraw();
		}
		refresh();
	});
}

/** What a label holds beside its checkbox. */
type Content = Node | string;

/** A fieldset the reader knows as `name`, holding `labels`. */
function fieldset(
	document: Document,
	name: string,
	labels: readonly HTMLLabelElement[],
): HTMLFieldSetElement {
	const set = document.createElement("fieldset");
	set.setAttribute("aria-label", name);
	set.append(...labels);
	return set;
}

/** A checkbox named `name` holding `value`, labelled by `text`. */
function checkbox(
	document: Document,
	name: string,
	value: string,
	checked: boolean,
	...text: Content[]
): HTMLLabelElement {
	const input = document.createElement("input");
	input.type = "checkbox";
	input.name = name;
	input.value = value;
	input.checked = checked;
	const label = document.createElement("label");
	label.append(input, ...text);
	return label;
}

function bold(document: Document, text: string): HTMLElement {
	const made = document.createElement("b");
	made.textContent = text;
	return made;
}

/** What `kind`'s switch says: `Cut sites`, `Features`. */
function said(kind: Kind): string {
	return SAID[kind] ?? kind[0].toUpperCase() + kind.slice(1);
}
