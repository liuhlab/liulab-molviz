import { defineConfig } from "vitest/config";

export default defineConfig({
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
	},
	test: {
		include: ["tests/**/*.test.ts"],
	},
});
