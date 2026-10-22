/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { checkGel } from "../../src/viewer/gel";
import { gelSvg } from "../../src/viewer/index";

const gels = import.meta.glob("../gels/*.json", {
	eager: true,
	import: "default",
});

test("the test gels are there to check", () => {
	expect(Object.keys(gels)).not.toHaveLength(0);
});

test.each(Object.entries(gels))("%s passes the gel check", (_, gel) => {
	expect(() => checkGel(gel)).not.toThrow();
});

test.each(Object.entries(gels))("%s draws, the same each time", (_, gel) => {
	expect(gelSvg(gel).svg).toBe(gelSvg(gel).svg);
});
