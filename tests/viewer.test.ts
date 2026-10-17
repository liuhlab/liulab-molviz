import { expect, test } from "vitest";
import { greet } from "../src/viewer/index";

test("greet addresses the name it is given", () => {
	expect(greet("lab")).toBe("Hello, lab!");
});

test("greet falls back to the world", () => {
	expect(greet()).toBe("Hello, world!");
});
