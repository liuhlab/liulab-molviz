/** The amino-acid chips over a translated feature's bar in the sequence view. */

import type { Bar } from "./arrows";
import type { Record } from "./record";
import type { Lane, Row } from "./sequence";

type Feature = Record["features"][number];

/** The chips of `feature` over its `bar` in `row`, in a lane from `top` down. */
export function chips(
	_feature: Feature,
	_bar: Bar,
	_row: Row,
	top: number,
): Lane {
	return { shapes: [], labels: [], bottom: top };
}
