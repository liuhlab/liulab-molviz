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

/** The page the Python package writes for `record`. */
function written(): string {
	const folder = mkdtempSync(join(tmpdir(), "molviz-"));
	const path = join(folder, "page.html");
	const write =
		"import json, sys, molviz; molviz.draw(json.loads(sys.argv[1])).write(sys.argv[2])";
	try {
		execFileSync("python", ["-c", write, JSON.stringify(record), path]);
		return readFileSync(path, "utf8");
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
}

test("a page the Python package writes draws its record when it opens", () => {
	const page = new DOMParser().parseFromString(written(), "text/html");
	document.head.replaceChildren(...page.head.childNodes);
	document.body.replaceChildren(...page.body.childNodes);
	// happy-dom runs a script in a function, where the viewer's `var molviz` is no global, so
	// each runs here in the global scope, as a browser runs it.
	for (const script of document.querySelectorAll("script:not([type])")) {
		vm.runInThisContext(script.textContent ?? "");
	}
	const drawn = document.querySelectorAll("#drawing > svg");
	expect(drawn).toHaveLength(1);
	const texts = [...drawn[0].querySelectorAll("text")];
	expect(texts.map((t) => t.textContent)).toContain("lacZ");
});
