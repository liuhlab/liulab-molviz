import { expect, test } from "vitest";
import { moved } from "../../src/viewer/scene";

test("moves a name set along a curve a letter at a time, each keeping its turn", () => {
	const name = {
		shape: "letters",
		text: "ab",
		face: "sans",
		size: 11.5,
		fill: "#000000",
		places: [
			[0, -180, -10],
			[7, -181, 0],
		],
	} as const;
	expect(moved(name, 5, 100)).toEqual({
		...name,
		places: [
			[5, -80, -10],
			[12, -81, 0],
		],
	});
});
