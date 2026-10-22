/// <reference types="vite/client" />
/** The test records, for the tests that run over every one. */

import type { check } from "../../src/viewer/format/record";

export type RecordFile = Parameters<typeof check>[0] & {
	readonly circular: boolean;
	readonly cuts?: readonly { enzyme: string }[];
};

/** Each test record, by its file's name. */
export const RECORDS = Object.entries(
	import.meta.glob("../records/*.json", {
		eager: true,
		import: "default",
	}) as { [path: string]: RecordFile },
).map(([path, file]) => [path.slice("../records/".length, -5), file] as const);

/** Every enzyme that cuts `file`. */
export function enzymesOf(file: {
	cuts?: readonly { enzyme: string }[];
}): string[] {
	return [...new Set((file.cuts ?? []).map(({ enzyme }) => enzyme))];
}

/** The enzymes a test over every record draws `file` with, each with its name. */
export function enzymeChoices(
	file: RecordFile,
): (readonly [string, { enzymes?: string[] }])[] {
	return [
		["the unique cutters", {}],
		["every enzyme", { enzymes: enzymesOf(file) }],
	];
}
