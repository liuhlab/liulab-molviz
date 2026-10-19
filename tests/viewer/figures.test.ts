/// <reference types="vite/client" />
import { expect, test } from "vitest";
import { figureSvg } from "../../src/viewer/figure";

/** A test figure: the records it stacks, by file name, and the options they share. */
interface Figure {
	readonly records: readonly string[];
	readonly options: unknown;
}

const figures: { [path: string]: Figure } = import.meta.glob(
	"../figures/*.json",
	{ eager: true, import: "default" },
);

const records = import.meta.glob("../records/*.json", {
	eager: true,
	import: "default",
});

test("the test figures are there to check", () => {
	expect(Object.keys(figures)).not.toHaveLength(0);
});

test.each(Object.entries(figures))(
	"%s draws its records, hiding nothing",
	(_, { records: names, options }) => {
		const stacked = names.map((name) => records[`../records/${name}.json`]);
		const drawn = figureSvg(stacked, options);
		expect(drawn.svg).toMatch(/^<svg /);
		expect(drawn.hidden).toEqual([]);
	},
);
