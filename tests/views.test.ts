// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, test } from "vitest";

const record = { name: "pTest", circular: false, bases: "ACGT".repeat(25) };
const gel = { ladder: { name: "ladder", bands: [100] }, lanes: [] };

/** A slot of the docs site naming `name`, holding `input` as its JSON block. */
function slot(name: string | null, block: string, input: unknown): string {
	const named = name === null ? "data-molviz" : `data-molviz="${name}"`;
	const json = `<script type="application/json" data-${block}>${JSON.stringify(input)}</script>`;
	return `<div ${named}>${json}</div>`;
}

test("the docs site draws each slot by its name, and says which name it does not know", () => {
	document.body.innerHTML = [
		slot(null, "record", record),
		slot("gel", "gel", gel),
		slot("tube", "tube", {}),
	].join("");
	for (const file of ["src/molviz/viewer.js", "docs/assets/molviz/views.js"]) {
		vm.runInThisContext(`{${readFileSync(file, "utf8")}\n}`);
	}
	const slots = [...document.querySelectorAll("[data-molviz]")];
	expect(slots.map((s) => s.querySelectorAll("svg").length)).toEqual([1, 1, 0]);
	expect(slots[2].querySelector("p")?.textContent).toContain('"tube"');
});
