import { readdirSync, readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import { fontTables } from "./scripts/font_tables.ts";

/**
 * A comment holding the licence of each package bundled from `modules`, and of the fonts.
 *
 * A package's licence is in its folder under the last `node_modules/` of a module's path. The
 * build fails on a bundled package with no licence file, rather than ship it without one.
 */
function notices(modules: string[]): string {
	const folders = new Set<string>();
	for (const id of modules) {
		const folder = id.match(/^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)\//)?.[1];
		if (folder) folders.add(folder);
	}
	const sections = [
		`DejaVu fonts\n\n${readFileSync("src/viewer/fonts/LICENSE", "utf8")}`,
	];
	for (const folder of [...folders].sort()) {
		const name = folder.slice(
			folder.lastIndexOf("/node_modules/") + "/node_modules/".length,
		);
		const file = readdirSync(folder).find((f) => /^licen[cs]e/i.test(f));
		if (!file)
			throw new Error(
				`${name} is bundled into the viewer and has no licence file`,
			);
		sections.push(`${name}\n\n${readFileSync(`${folder}/${file}`, "utf8")}`);
	}
	return `/*!\n${sections.join("\n\n").replaceAll("*/", "* /")}\n*/`;
}

export default defineConfig({
	plugins: [fontTables()],
	build: {
		// One self-contained script that sets the global `molviz`, so a page inlines it in a plain
		// <script>. A fixed name and no hash: the same release must ship the same bytes.
		lib: {
			entry: "src/viewer/index.ts",
			formats: ["iife"],
			name: "molviz",
			fileName: () => "viewer.js",
		},
		// Into the Python package, which holds other files: never empty it.
		outDir: "src/molviz",
		emptyOutDir: false,
		copyPublicDir: false,
		// `postBanner`, not `banner`: the minifier drops a banner.
		rolldownOptions: {
			output: { postBanner: (chunk) => notices(chunk.moduleIds) },
		},
	},
	test: {
		include: ["tests/**/*.test.ts"],
		setupFiles: ["tests/outlines.ts"],
	},
});
