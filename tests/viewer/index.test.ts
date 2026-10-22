// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, test } from "vitest";

const record = { name: "pTest", circular: false, bases: "ACGT".repeat(25) };

/** A good input of each name in `calls`. */
const given: { readonly [name: string]: unknown } = {
	record,
	gel: { ladder: { name: "ladder", bands: [100] }, lanes: [] },
	plate: { rows: 2, columns: 3, wells: { A1: "water" } },
	figure: [record, { ...record, name: "pTest 2" }],
};

/** The four calls an input answers, by their role. */
interface Calls {
	readonly check: string;
	readonly draw: string;
	readonly svg: string;
	readonly still: string;
}

/** The global `molviz`: `calls`, and every other name the viewer sets on it. */
interface Global {
	readonly calls: { readonly [input: string]: Calls };
	readonly [name: string]: unknown;
}

// The built viewer, run as a page runs it.
vm.runInThisContext(`{${readFileSync("src/molviz/viewer.js", "utf8")}\n}`);
const molviz = (globalThis as unknown as { molviz: Global }).molviz;

/** The global's call `name`. */
function call(name: string): (...args: unknown[]) => never {
	return molviz[name] as (...args: unknown[]) => never;
}

test("every input in calls has a good input here", () => {
	expect(Object.keys(molviz.calls)).toEqual(Object.keys(given));
});

test("every name in calls is a function on the global, each named once", () => {
	const names = Object.values(molviz.calls).flatMap((calls) =>
		Object.values(calls),
	);
	expect(new Set(names).size).toBe(names.length);
	for (const name of names) expect(typeof molviz[name]).toBe("function");
});

test.each(Object.keys(given))("the %s answers all four calls", (name) => {
	const input = given[name];
	const calls = molviz.calls[name];
	expect(Object.keys(calls).sort()).toEqual(["check", "draw", "still", "svg"]);
	expect(call(calls.check)(input)).toMatchObject(input as object);

	const element = document.createElement("div");
	const drawing: { destroy(): void } = call(calls.draw)(element, input);
	expect(element.querySelector("svg")).not.toBeNull();
	drawing.destroy();
	expect(element.children).toHaveLength(0);

	const file: { svg: string; pages: string[]; hidden: []; notice: string } =
		call(calls.svg)(input);
	expect(file.svg).toMatch(/^<svg /);
	expect(file.pages).toEqual([file.svg]);
	expect(file).toMatchObject({ hidden: [], notice: "" });

	const still: { svg: string; hidden: []; notice: string } = call(calls.still)(
		input,
	);
	expect(still.svg).toMatch(/^<svg /);
	expect(still.svg).toContain("<text ");
	expect(still).toEqual({ svg: still.svg, hidden: [], notice: "" });
});
