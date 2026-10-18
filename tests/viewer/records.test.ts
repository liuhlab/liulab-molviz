/// <reference types="vite/client" />
import { expect, test } from "vitest";
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
