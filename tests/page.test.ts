// @vitest-environment happy-dom
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { OUTLINES_GLOBAL } from "virtual:molviz-fonts";
import { expect, test, vi } from "vitest";
import { WIDTH } from "../src/viewer/line";

const record = {
	name: "pTest",
	circular: false,
	bases: "ACGT".repeat(25),
	features: [
		{
			name: "lacZ",
			type: "CDS",
			strand: 1,
			segments: [{ start: 10, end: 60 }],
		},
	],
};

const gel = {
	ladder: { name: "ladder", bands: [100, 1000] },
	lanes: [{ name: "GFP", bands: [741] }],
};

const plate = { rows: 2, columns: 3, wells: { A1: "quarter 1" } };

/**
 * The page the Python package's `draw`, or another of its calls, writes for `input` with
 * `options`.
 */
function written(call: string, input: unknown, options = {}): string {
	const folder = mkdtempSync(join(tmpdir(), "molviz-"));
	const path = join(folder, "page.html");
	const write = `import json, sys, molviz; molviz.${call}(json.loads(sys.argv[1]), **json.loads(sys.argv[3])).write(sys.argv[2])`;
	try {
		execFileSync("python", [
			"-c",
			write,
			JSON.stringify(input),
			path,
			JSON.stringify(options),
		]);
		return readFileSync(path, "utf8");
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
}

/** Open `html` in this document and run its scripts, returning what it drew. */
function open(html: string): NodeListOf<SVGSVGElement> {
	const page = new DOMParser().parseFromString(html, "text/html");
	document.head.replaceChildren(...page.head.childNodes);
	document.body.replaceChildren(...page.body.childNodes);
	// happy-dom runs a script in a function, where the viewer's `var molviz` is no global, so
	// each runs here in the global scope, as a browser runs it. A block keeps one page's `const`
	// from meeting the last page's, as a browser's fresh window would.
	for (const script of document.querySelectorAll("script:not([type])")) {
		vm.runInThisContext(`{${script.textContent ?? ""}\n}`);
	}
	return document.querySelectorAll("#drawing svg");
}

test("a page the Python package writes draws its record when it opens, with no outline script", () => {
	vi.stubGlobal(OUTLINES_GLOBAL, undefined);
	try {
		const drawn = open(written("draw", record));
		expect(drawn).toHaveLength(1);
		const texts = [...drawn[0].querySelectorAll("text")];
		expect(texts.map((t) => t.textContent)).toContain("lacZ");
		const page = document.querySelector("#drawing > .molviz");
		expect(
			page?.querySelector(":scope > .bar input[value='sequence']"),
		).not.toBeNull();
		expect(page?.querySelector(":scope > .map > svg")).toBe(drawn[0]);
	} finally {
		vi.unstubAllGlobals();
	}
});

test("a drag across the map of a page the Python package writes selects the bases and says them", () => {
	vi.stubGlobal(OUTLINES_GLOBAL, undefined);
	try {
		open(written("draw", record, { sequence_view: true }));
		const map = document.querySelector("#drawing .map svg");
		if (!map?.firstElementChild) throw new Error("no map drawn");
		// A page with no layout sets a drawing's points one to a client pixel.
		const at = (base: number) => ({
			clientX: ((base + 0.5) * WIDTH) / record.bases.length,
			clientY: 0,
		});
		const press = { bubbles: true, pointerId: 1, pointerType: "mouse" };
		map.firstElementChild.dispatchEvent(
			new PointerEvent("pointerdown", { ...press, ...at(10) }),
		);
		map.dispatchEvent(new PointerEvent("pointermove", { ...press, ...at(59) }));
		map.dispatchEvent(new PointerEvent("pointerup", { ...press, ...at(59) }));
		const said = document.querySelector("#drawing .sequence > .bar output");
		expect(said?.textContent).toBe("11 .. 60 (50 bp)");
		const sequence = document.querySelector("#drawing .sequence svg");
		expect(sequence?.querySelectorAll("rect[fill='#bbddf5']")).toHaveLength(1);
	} finally {
		vi.unstubAllGlobals();
	}
});

test.each([
	{ input: "gel", call: "draw_gel", data: gel, hover: "741 bp" },
	{ input: "plate", call: "draw_plate", data: plate, hover: "A1: quarter 1" },
])(
	"a page the Python package writes for a $input holds its drawing, with no script",
	({ call, data, hover }) => {
		const drawn = open(written(call, data));
		expect(document.querySelectorAll("script")).toHaveLength(0);
		expect(drawn).toHaveLength(1);
		const titles = [...drawn[0].querySelectorAll("title")];
		expect(titles.map((t) => t.textContent)).toContain(hover);
		expect(document.querySelector("style")?.textContent).toContain(
			"@font-face",
		);
	},
);
