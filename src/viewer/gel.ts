/** The gel format: a ladder and sample lanes, each band by its size. */

import * as v from "valibot";
import { exact, list, PositiveInteger, parse, Text } from "./format";

const gelSchema = exact({
	title: v.optional(Text),
	ladder: exact({
		name: Text,
		bands: v.pipe(
			list(PositiveInteger),
			v.minLength(1, "must hold at least one band"),
		),
	}),
	lanes: list(exact({ name: Text, bands: list(PositiveInteger) })),
});

/** A gel as a caller hands it over. */
export type Gel = v.InferOutput<typeof gelSchema>;

/** Return `input` as a typed gel, or throw one FormatError naming every problem by its path. */
export function checkGel(input: unknown): Gel {
	return parse(gelSchema, input, { name: "gel" });
}
