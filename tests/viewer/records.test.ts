/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { svg } from "../../src/viewer/index";
import { check } from "../../src/viewer/record";

const records = import.meta.glob("../records/*.json", {
	eager: true,
	import: "default",
});

test("the test records are there to check", () => {
	expect(Object.keys(records)).not.toHaveLength(0);
});

test.each(Object.entries(records))("%s passes the check", (_, record) => {
	expect(() => check(record)).not.toThrow();
});

test.each(Object.entries(records))(
	"%s draws, the same text each time",
	(_, record) => {
		const first = svg(record).svg;
		expect(first).toMatch(/^<svg /);
		expect(svg(structuredClone(record)).svg).toBe(first);
	},
);

test("colour-test draws across its origin", () => {
	const record = records["../records/colour-test.json"];
	expect(() => svg(record, { span: { start: 2600, end: 2750 } })).not.toThrow();
});
