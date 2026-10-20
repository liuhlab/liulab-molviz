/// <reference types="vite/client" />
/** A drawing's labels read back from its shapes, and the boxes of the rest, for the views' tests. */

import { boxOf } from "../../src/viewer/bounds";
import type { check } from "../../src/viewer/record";
import type { Box, Scene, Shape } from "../../src/viewer/scene";
import { baseline, height, measure } from "../../src/viewer/text";
import { crosses, overlap, TOUCH } from "./round";

type Line = Extract<Shape, { shape: "line" }>;
type Rect = Extract<Shape, { shape: "rect" }>;
type Text = Extract<Shape, { shape: "text" }>;

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

/** A label set on a leader: its box, its leader, and the leader's part carried on to the backbone. */
export interface Outside {
	readonly box: Box;
	readonly leader: Line;
	readonly inward: Line | null;
}

function isLeader(shape: Shape): shape is Line {
	return (
		shape.shape === "line" &&
		shape.stroke === "#7f7f7f" &&
		shape.strokeWidth === 0.8
	);
}

function isLabelText(shape: Shape): shape is Text {
	return shape.shape === "text" && shape.size === 11.5 && !shape.rotate;
}

/** The shapes of each label on a leader, in the order drawn: its leaders, then its box or text. */
function chains(scene: Scene): { lines: Line[]; parts: (Rect | Text)[] }[] {
	const found: { lines: Line[]; parts: (Rect | Text)[] }[] = [];
	let open = false;
	for (const shape of scene.shapes) {
		const last = found[found.length - 1];
		if (isLeader(shape)) {
			if (open && last.parts.length === 0) last.lines.push(shape);
			else found.push({ lines: [shape], parts: [] });
			open = true;
		} else if (open && (shape.shape === "rect" || isLabelText(shape))) {
			last.parts.push(shape);
		} else open = false;
	}
	return found;
}

/** Each label on a leader, read from the shapes that draw it. */
export function labelsOf(scene: Scene): Outside[] {
	return chains(scene).map(({ lines, parts }) => ({
		box: labelBox(parts),
		leader: lines[lines.length - 1],
		inward: lines.length > 1 ? lines[0] : null,
	}));
}

/** A label's box: its rectangle, or its text with 3 points either side and 1 above and below. */
function labelBox(parts: readonly (Rect | Text)[]): Box {
	const [first] = parts;
	if (first.shape === "rect") return first;
	const last = parts[parts.length - 1] as Text;
	const tall = height("sans", 11.5) + 2;
	const x = first.x - 3;
	const middle = first.y - baseline("sans", 11.5, 0);
	return {
		x,
		y: middle - tall / 2,
		width: last.x + measure(last.text, last.face, 11.5) + 3 - x,
		height: tall,
	};
}

/**
 * What a line or a row of bases draws: each label on a leader; the box of each name set on or
 * under what it names; and the box of every other shape but a leader, a line's stroke included.
 */
function apart(scene: Scene): {
	labels: Outside[];
	names: Box[];
	drawing: Box[];
} {
	const used = new Set<Shape>(
		chains(scene).flatMap(({ lines, parts }) => [...lines, ...parts]),
	);
	const rest = scene.shapes.filter((s) => !used.has(s) && !isLeader(s));
	return {
		labels: labelsOf(scene),
		names: rest.filter(isLabelText).map((s) => boxOf(s) as Box),
		drawing: rest
			.filter((s) => !isLabelText(s))
			.flatMap((s) => (s.shape === "line" ? stroked(s) : (boxOf(s) ?? []))),
	};
}

/** Each two labels or names in `scene` that overlap. */
export function overlapping(scene: Scene): [Box, Box][] {
	const { labels, names } = apart(scene);
	const boxes = [...labels.map(({ box }) => box), ...names];
	return boxes.flatMap((one, k) =>
		boxes
			.slice(k + 1)
			.filter((other) => overlap(one, other))
			.map((other): [Box, Box] => [one, other]),
	);
}

/**
 * Each label or name in `scene` with what it overlaps of the drawing. A name may lie inside one
 * shape, the arrow it names.
 */
export function onTheDrawing(scene: Scene): [Box, Box[]][] {
	const { labels, names, drawing } = apart(scene);
	const met = (box: Box) => drawing.filter((shape) => overlap(box, shape));
	return [
		...labels.map(({ box }): [Box, Box[]] => [box, met(box)]),
		...names.map((box): [Box, Box[]] => {
			const shapes = met(box);
			return [box, shapes.length === 1 && within(box, shapes[0]) ? [] : shapes];
		}),
	].filter(([, shapes]) => shapes.length);
}

/** Each leader in `scene` with the labels and names it crosses but its own. */
export function crossing(scene: Scene): [Line, Box[]][] {
	const { labels, names } = apart(scene);
	const boxes = [...labels.map(({ box }) => box), ...names];
	return labels
		.map(({ box, leader }): [Line, Box[]] => [
			leader,
			boxes.filter(
				(other) =>
					other !== box &&
					crosses(
						[
							{ x: leader.x1, y: leader.y1 },
							{ x: leader.x2, y: leader.y2 },
						],
						other,
					),
			),
		])
		.filter(([, crossed]) => crossed.length);
}

/** The box a straight line's stroke covers, its ends cut square. */
function stroked({ x1, y1, x2, y2, strokeWidth }: Line): Box {
	const half = strokeWidth / 2;
	const padX = y1 === y2 ? 0 : half;
	const padY = x1 === x2 ? 0 : half;
	return {
		x: Math.min(x1, x2) - padX,
		y: Math.min(y1, y2) - padY,
		width: Math.abs(x2 - x1) + 2 * padX,
		height: Math.abs(y2 - y1) + 2 * padY,
	};
}

/** Whether `box` lies inside `outer`. */
function within(box: Box, outer: Box): boolean {
	return (
		outer.x - TOUCH <= box.x &&
		box.x + box.width <= outer.x + outer.width + TOUCH &&
		outer.y - TOUCH <= box.y &&
		box.y + box.height <= outer.y + outer.height + TOUCH
	);
}
