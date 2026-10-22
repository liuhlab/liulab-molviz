/** A drawing's labels read back from its shapes, and the checks that they keep apart. */

import { describe, expect, test } from "vitest";
import { boxOf } from "../../src/viewer/bounds";
import { check, type Record } from "../../src/viewer/format/record";
import { LABEL_SIZE, PAD_X, PAD_Y } from "../../src/viewer/labels";
import { LEADER, LEADER_WIDTH } from "../../src/viewer/paint";
import type { Box, Scene, Shape } from "../../src/viewer/scene";
import { baseline, height, measure } from "../../src/viewer/text/text";
import { enzymeChoices, type RecordFile } from "./records";
import { crosses, overlap, segment, TOUCH } from "./round";

type Line = Extract<Shape, { shape: "line" }>;
type Rect = Extract<Shape, { shape: "rect" }>;
type Text = Extract<Shape, { shape: "text" }>;

/** A label set on a leader: its box, its leader, and the leader's part carried on to the backbone. */
export interface LabelOnLeader {
	readonly box: Box;
	readonly leader: Line;
	readonly toBackbone: Line | null;
}

/** Whether `shape` is a line from a label to what it names. */
function isLeader(shape: Shape): shape is Line {
	return (
		shape.shape === "line" &&
		shape.stroke === LEADER &&
		shape.strokeWidth === LEADER_WIDTH
	);
}

/** The lines from a label to what it names. */
export function leaders(scene: Scene): Line[] {
	return scene.shapes.filter(isLeader);
}

function isLabelText(shape: Shape): shape is Text {
	return shape.shape === "text" && shape.size === LABEL_SIZE && !shape.rotate;
}

/** Each label on a leader as the shapes that draw it: its leader's lines, then its box or text. */
function labelShapes(
	scene: Scene,
): { lines: Line[]; parts: (Rect | Text)[] }[] {
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
export function labelsOf(scene: Scene): LabelOnLeader[] {
	return labelShapes(scene).map(({ lines, parts }) => ({
		box: labelBox(parts),
		leader: lines[lines.length - 1],
		toBackbone: lines.length > 1 ? lines[0] : null,
	}));
}

function labelBox(parts: readonly (Rect | Text)[]): Box {
	const [first] = parts;
	if (first.shape === "rect") return first;
	const last = parts[parts.length - 1] as Text;
	const tall = height("sans", LABEL_SIZE) + 2 * PAD_Y;
	const x = first.x - PAD_X;
	const middle = first.y - baseline("sans", LABEL_SIZE, 0);
	return {
		x,
		y: middle - tall / 2,
		width: last.x + measure(last.text, last.face, LABEL_SIZE) + PAD_X - x,
		height: tall,
	};
}

/**
 * A drawing's shapes by role: each label on a leader; the box of each name set on or under what
 * it names; and the box of every other shape but a leader, a stroke's box as wide as the stroke.
 */
function byRole(scene: Scene): {
	labels: LabelOnLeader[];
	names: Box[];
	drawing: Box[];
} {
	const used = new Set<Shape>(
		labelShapes(scene).flatMap(({ lines, parts }) => [...lines, ...parts]),
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
	const { labels, names } = byRole(scene);
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
	const { labels, names, drawing } = byRole(scene);
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
	const { labels, names } = byRole(scene);
	const boxes = [...labels.map(({ box }) => box), ...names];
	return labels
		.map(({ box, leader }): [Line, Box[]] => [
			leader,
			boxes.filter((other) => other !== box && crosses(segment(leader), other)),
		])
		.filter(([, crossed]) => crossed.length);
}

/**
 * Pins, for each record in `files` that `lay` draws with each choice of enzymes, that no two
 * labels overlap, none overlaps the drawing, and no leader crosses another label.
 */
export function keepsApart(
	title: string,
	files: readonly (readonly [string, RecordFile])[],
	lay: (record: Record, given: { enzymes?: string[] }) => Scene,
): void {
	describe.each(files)(title, (_, file) => {
		describe.each(enzymeChoices(file))("with %s", (__, given) => {
			const scene = lay(check(file), given);

			test("no two labels overlap, and none overlaps the drawing", () => {
				expect(overlapping(scene)).toEqual([]);
				expect(onTheDrawing(scene)).toEqual([]);
			});

			test("no leader crosses another label", () => {
				expect(crossing(scene)).toEqual([]);
			});
		});
	});
}

/** The box a straight stroke covers, its ends cut square. */
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
