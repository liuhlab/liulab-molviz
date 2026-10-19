// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, test } from "vitest";

const record = { name: "pTest", circular: false, bases: "ACGT".repeat(25) };
const gel = { ladder: { name: "ladder", bands: [100] }, lanes: [] };

/**
 * A slot of the docs site naming `name`, holding `input` as its JSON block and any `options`,
 * marked still when `still` is set.
 */
function slot(
	name: string | null,
	block: string,
	input: unknown,
	{ options, still = false }: { options?: unknown; still?: boolean } = {},
): string {
	const named = name === null ? "data-molviz" : `data-molviz="${name}"`;
	const json = (key: string, value: unknown) =>
		`<script type="application/json" data-${key}>${JSON.stringify(value)}</script>`;
	const held =
		json(block, input) +
		(options === undefined ? "" : json("options", options));
	return `<div ${named}${still ? " data-still" : ""}>${held}</div>`;
}

/** Open a page holding `slots`, run the viewer and the docs site's script, and return them. */
function open(slots: string[]): Element[] {
	document.head.replaceChildren();
	document.body.innerHTML = slots.join("");
	for (const file of ["src/molviz/viewer.js", "docs/assets/molviz/views.js"]) {
		vm.runInThisContext(`{${readFileSync(file, "utf8")}\n}`);
	}
	return [...document.querySelectorAll("[data-molviz]")];
}

/** `svg` as it reads once a page has parsed it. */
function parsed(svg: string): string | undefined {
	const holder = document.createElement("div");
	holder.innerHTML = svg;
	return holder.firstElementChild?.outerHTML;
}

test("the docs site draws each slot by its name, and says which name it does not know", () => {
	const slots = open([
		slot(null, "record", record),
		slot("gel", "gel", gel),
		slot("tube", "tube", {}),
	]);
	expect(slots.map((s) => s.querySelectorAll("svg").length)).toEqual([1, 1, 0]);
	expect(slots[2].querySelector("p")?.textContent).toContain('"tube"');
});

test("a still slot holds its input's still drawing, and the page holds the font rules once", () => {
	const options = { sequence_view: true };
	const slots = open([
		slot(null, "record", record, { options, still: true }),
		slot("gel", "gel", gel, { still: true }),
	]);
	const viewer = (globalThis as unknown as { molviz: Viewer }).molviz;
	expect(slots[0].querySelector("svg")?.outerHTML).toBe(
		parsed(viewer.stillSvg(record, options).svg),
	);
	expect(slots[1].querySelector("svg")?.outerHTML).toBe(
		parsed(viewer.gelStillSvg(gel).svg),
	);
	const styles = [...document.querySelectorAll("style")];
	expect(styles.map((style) => style.textContent)).toEqual([
		viewer.fontRules(),
	]);
});

/** The viewer's calls this file uses, as `viewer.js` sets them on the global. */
interface Viewer {
	stillSvg(record: unknown, options?: unknown): { svg: string };
	gelStillSvg(gel: unknown): { svg: string };
	fontRules(): string;
}
