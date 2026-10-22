import { describe, expect, test } from "vitest";
import { layoutCircle } from "../../src/viewer/circle";
import { layoutLine } from "../../src/viewer/line";
import { checkOptions } from "../../src/viewer/options";
import { check } from "../../src/viewer/record";
import { prepare } from "../../src/viewer/views";

const good = { name: "p", circular: false, bases: "ACGT".repeat(25) };

describe("prepare", () => {
	test("lays a whole circular record out as the circle, or as the line when asked", () => {
		const circular = check({ ...good, circular: true });
		expect(prepare(circular, {})).toStrictEqual(
			layoutCircle(circular, checkOptions({}, circular)),
		);
		expect(prepare(circular, { map: "line" })).toStrictEqual(
			layoutLine(circular, checkOptions({ map: "line" }, circular)),
		);
	});
});
