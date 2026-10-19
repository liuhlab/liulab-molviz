/**
 * A record's switches in its frame's bar: each kind it holds, each feature type and each enzyme,
 * the flip between the circle and the line, and the sequence view's switch.
 */

import { byName, cutCounts } from "./cuts";
import { folded } from "./format";
import { type Frame, fieldset } from "./frame";
import { KINDS, type Kind } from "./labels";
import { LIMIT, type Options } from "./options";

/** What a kind's switch says, where that is not its key capitalised. */
const SAID: { readonly [K in Kind]?: string } = { cuts: "Cut sites" };

/** The kinds only the sequence view draws, whose switches show only with it. */
const SEQUENCE_ONLY: ReadonlySet<string> = new Set(["tracks"]);

/** How a change to a switch sets the options, by the switch's name. */
const CHANGES = new Map<
	string,
	(input: HTMLInputElement, options: Options) => Partial<Options>
>([
	["map", ({ value }) => ({ map: value as Options["map"] })],
	["sequence", ({ checked }) => ({ sequence_view: checked })],
	[
		"kind",
		(input, { kinds_off }) => ({ kinds_off: toggled(kinds_off, input) }),
	],
	[
		"type",
		(input, { types_off }) => ({ types_off: toggled(types_off, input) }),
	],
	["enzyme", ({ form }) => ({ enzymes: ticked(form, "enzyme") })],
]);

/**
 * Add `frame`'s switches to its bar, each ticked as the frame's options start: at the left the
 * kinds the record holds, its feature types, and its enzymes folded in a list; at the right the
 * views. A change sets the options and lays the frame out again.
 */
export function switches(frame: Frame): void {
	const { record, bar } = frame;
	const document = bar.ownerDocument;
	const { kinds_off, types_off, enzymes } = frame.state.options;
	const make = (name: string, value: string, on: boolean, ...text: Content[]) =>
		labelled(document, "checkbox", name, value, on, ...text);

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

	const refresh = () => {
		const { kinds_off, sequence_view } = frame.state.options;
		const count = list.querySelectorAll("input:checked").length;
		summary.textContent = `Enzymes (${count} of ${counts.size})`;
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
	const views = viewSwitches(frame);
	if (views !== null) bar.append(views);

	bar.addEventListener("change", (event) => {
		const input = event.target as HTMLInputElement;
		const change = CHANGES.get(input.name);
		if (change) {
			const { options } = frame.state;
			frame.state.options = { ...options, ...change(input, options) };
			frame.redraw();
		}
		refresh();
	});
}

/**
 * The flip between Circle and Line, for a whole circular record, and the sequence view's switch,
 * for a span the view can draw; null if neither.
 */
function viewSwitches({
	record,
	state,
	bar,
}: Frame): HTMLFieldSetElement | null {
	const { span, map, sequence_view } = state.options;
	const document = bar.ownerDocument;
	const labels: HTMLLabelElement[] = [];
	const said = (value: string) => value[0].toUpperCase() + value.slice(1);
	if (record.circular && span.start === 0 && span.end === record.bases.length) {
		for (const name of ["circle", "line"] as const) {
			labels.push(
				labelled(document, "radio", "map", name, map === name, said(name)),
			);
		}
	}
	if (span.end - span.start <= LIMIT) {
		labels.push(
			labelled(
				document,
				"checkbox",
				"sequence",
				"sequence",
				sequence_view,
				said("sequence"),
			),
		);
	}
	return labels.length ? fieldset(document, "Views", labels, "views") : null;
}

/** What a label holds beside its input. */
type Content = Node | string;

/** An input of `type` named `name` holding `value`, labelled by `text`. */
function labelled(
	document: Document,
	type: "radio" | "checkbox",
	name: string,
	value: string,
	checked: boolean,
	...text: Content[]
): HTMLLabelElement {
	const input = document.createElement("input");
	input.type = type;
	input.name = name;
	input.value = value;
	input.checked = checked;
	const label = document.createElement("label");
	label.append(input, ...text);
	return label;
}

/** `off` with the value of the checkbox `input` taken out if it is ticked, else put in. */
function toggled<T extends string>(
	off: readonly T[],
	{ value, checked }: HTMLInputElement,
): T[] {
	return checked ? off.filter((one) => one !== value) : [...off, value as T];
}

/** The values of the ticked inputs named `name` in `form`, in order. */
function ticked(form: HTMLFormElement | null, name: string): string[] {
	const inputs = form?.querySelectorAll<HTMLInputElement>(
		`input[name="${name}"]:checked`,
	);
	return [...(inputs ?? [])].map((one) => one.value);
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
