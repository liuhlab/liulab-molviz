/** The plate format: a grid of wells, and the text of what each well holds. */

import * as v from "valibot";
import { exact, Integer, parse, Text } from "./record";

/** A well's place on its plate, each counted from 0. */
export interface Place {
	readonly row: number;
	readonly column: number;
}

const WELL_NAME = /^([A-Z]+)([1-9][0-9]*)$/;

/** Return a 0-based row's letters: `A` to `Z`, then `AA` on. */
export function rowLabel(row: number): string {
	let letters = "";
	for (let rest = row + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
		letters = String.fromCharCode(65 + ((rest - 1) % 26)) + letters;
	}
	return letters;
}

/** Return the name of the well at a 0-based row and column, such as `B3` for 1 and 2. */
export function wellName(row: number, column: number): string {
	return `${rowLabel(row)}${column + 1}`;
}

/** Return the place a well name such as `B3` names, or `undefined` where it names none. */
export function wellAt(name: string): Place | undefined {
	const match = WELL_NAME.exec(name);
	if (!match) return undefined;
	const [, letters = "", digits = ""] = match;
	let row = 0;
	for (const letter of letters) row = row * 26 + letter.charCodeAt(0) - 64;
	return { row: row - 1, column: Number(digits) - 1 };
}

const Count = v.pipe(Integer, v.minValue(1, "must be 1 or more"));

/** How many rows and columns a plate's well names are checked against. */
interface Size {
	readonly rows: number;
	readonly columns: number;
}

/**
 * Where `rows` or `columns` is malformed the size is unbounded, so a well name is checked
 * only for its form.
 */
function sizeOf(input: unknown): Size {
	const { rows, columns } = (
		typeof input === "object" && input !== null ? input : {}
	) as { rows?: unknown; columns?: unknown };
	if (v.is(Count, rows) && v.is(Count, columns)) return { rows, columns };
	return { rows: Number.POSITIVE_INFINITY, columns: Number.POSITIVE_INFINITY };
}

const Contents = v.pipe(Text, v.nonEmpty("must not be empty"));

/** What is wrong with a well name on a plate of `size`, or `undefined` where nothing is. */
function nameProblem(
	name: string,
	{ rows, columns }: Size,
): string | undefined {
	const place = wellAt(name);
	if (!place) return "not a well name, such as B3";
	if (place.row < rows && place.column < columns) return undefined;
	return `not on the plate, which runs A1 to ${wellName(rows - 1, columns - 1)}`;
}

/**
 * Each well's contents, by a name the plate has. Every name is checked, `__proto__`
 * included, which valibot's record schema skips.
 */
function wells(size: Size) {
	return v.intersect([
		v.record(v.string(), Contents, "must be an object"),
		v.pipe(
			v.unknown(),
			v.rawCheck(({ dataset, addIssue }) => {
				if (typeof dataset.value !== "object" || dataset.value === null) return;
				const input = dataset.value as { [key: string]: unknown };
				for (const key of Object.keys(input)) {
					const message = nameProblem(key, size);
					if (message === undefined) continue;
					const value = input[key];
					addIssue({
						message,
						path: [{ type: "object", origin: "key", input, key, value }],
					});
				}
			}),
		),
	]);
}

function plateSchema(size: Size) {
	return exact({
		title: v.optional(Text),
		rows: Count,
		columns: Count,
		wells: v.optional(wells(size)),
	});
}

/** A plate as a caller hands it over. */
export type Plate = v.InferOutput<ReturnType<typeof plateSchema>>;

/** Return `input` as a typed plate, or throw one FormatError naming every problem by its path. */
export function checkPlate(input: unknown): Plate {
	return parse(plateSchema(sizeOf(input)), input, "", "plate");
}
