/** The gel format: a ladder and sample lanes, each band by its size. */

import * as v from "valibot";
import { exact, Integer, list, parse, Text } from "./format";

/** A band's size in bp. */
const Band = v.pipe(Integer, v.minValue(1, "must be 1 or more"));

const gelSchema = exact({
	title: v.optional(Text),
	ladder: exact({
		name: Text,
		bands: v.pipe(list(Band), v.minLength(1, "must hold at least one band")),
	}),
	lanes: list(exact({ name: Text, bands: list(Band) })),
});

/** A gel as a caller hands it over. */
export type Gel = v.InferOutput<typeof gelSchema>;

/** Return `input` as a typed gel, or throw one FormatError naming every problem by its path. */
export function checkGel(input: unknown): Gel {
	return parse(gelSchema, input, { name: "gel" });
}
