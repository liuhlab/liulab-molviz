/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { checkPlate } from "../../src/viewer/plate";

const plates = import.meta.glob("../plates/*.json", {
	eager: true,
	import: "default",
});

test("the test plates are there to check", () => {
	expect(Object.keys(plates)).not.toHaveLength(0);
});

test.each(Object.entries(plates))("%s passes the plate check", (_, plate) => {
	expect(() => checkPlate(plate)).not.toThrow();
});
