// @vitest-environment happy-dom
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { expect, test } from "vitest";

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

/** The page the Python package's `draw`, or another of its calls, writes for `input`. */
function written(call: string, input: unknown): string {
	const folder = mkdtempSync(join(tmpdir(), "molviz-"));
	const path = join(folder, "page.html");
	const write = `import json, sys, molviz; molviz.${call}(json.loads(sys.argv[1])).write(sys.argv[2])`;
	try {
		execFileSync("python", ["-c", write, JSON.stringify(input), path]);
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
	return document.querySelectorAll("#drawing > svg");
}

test("a page the Python package writes draws its record when it opens", () => {
	const drawn = open(written("draw", record));
	expect(drawn).toHaveLength(1);
	const texts = [...drawn[0].querySelectorAll("text")];
	expect(texts.map((t) => t.textContent)).toContain("lacZ");
});

test("a page the Python package writes for a gel draws it when it opens", () => {
	const drawn = open(written("draw_gel", gel));
	expect(drawn).toHaveLength(1);
	const titles = [...drawn[0].querySelectorAll("title")];
	expect(titles.map((t) => t.textContent)).toContain("741 bp");
});
