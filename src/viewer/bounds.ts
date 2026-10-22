/** The box each shape of a scene covers. */

import { type Box, leftEdge, type PathCommand, type Shape } from "./scene";
import { height, measure, metrics, textWidth } from "./text/text";

type Point = readonly [x: number, y: number];
type Arc = Extract<PathCommand, readonly ["A", ...unknown[]]>;

/** The box `shape` covers, a stroke left out, or `null` for a line, which covers none. */
export function boxOf(shape: Shape): Box | null {
	switch (shape.shape) {
		case "line":
			return null;
		case "rect":
			return shape;
		case "polygon":
			return around(shape.points);
		case "path":
			return around(pathPoints(shape.commands));
		case "letters": {
			const { face, size, places } = shape;
			const points = [...shape.text].flatMap((letter, i) => {
				const [x, y, rotate] = places[i];
				const box = {
					x,
					y: y - metrics(face).ascent * size,
					width: measure(letter, face, size),
					height: height(face, size),
				};
				return corners(box).map((c) => turn(c, [x, y], rotate));
			});
			return around(points);
		}
		case "circle":
			return {
				x: shape.cx - shape.r,
				y: shape.cy - shape.r,
				width: 2 * shape.r,
				height: 2 * shape.r,
			};
		case "text": {
			const width = textWidth(shape.text, shape.face, shape.size, shape.cell);
			const box = {
				x: leftEdge(shape, width),
				y: shape.y - metrics(shape.face).ascent * shape.size,
				width,
				height: height(shape.face, shape.size),
			};
			const { x, y, rotate } = shape;
			return rotate === undefined
				? box
				: around(corners(box).map((c) => turn(c, [x, y], rotate)));
		}
	}
}

/** The four corners of `box`. */
function corners({ x, y, width, height }: Box): Point[] {
	return [
		[x, y],
		[x + width, y],
		[x + width, y + height],
		[x, y + height],
	];
}

/** `point` turned `degrees` clockwise about `pivot`. */
function turn([x, y]: Point, [px, py]: Point, degrees: number): Point {
	const angle = (degrees * Math.PI) / 180;
	const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
	const [dx, dy] = [x - px, y - py];
	return [px + dx * cos - dy * sin, py + dx * sin + dy * cos];
}

/** The least box around `boxes`, of which there is at least one, and `margin` beyond. */
export function aroundBoxes(boxes: readonly Box[], margin = 0): Box {
	const left = Math.min(...boxes.map((b) => b.x)) - margin;
	const top = Math.min(...boxes.map((b) => b.y)) - margin;
	const right = Math.max(...boxes.map((b) => b.x + b.width)) + margin;
	const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + margin;
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/** The least box around `points`, or nothing for none. */
function around(points: readonly Point[]): Box | null {
	if (!points.length) return null;
	const xs = points.map(([x]) => x);
	const ys = points.map(([, y]) => y);
	const x = Math.min(...xs);
	const y = Math.min(...ys);
	return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Points whose box is the path's: each end of a step, and where an arc is furthest out. */
function pathPoints(commands: readonly PathCommand[]): Point[] {
	const points: Point[] = [];
	let at: Point = [0, 0];
	for (const command of commands) {
		if (command[0] === "Z") continue;
		const end: Point =
			command[0] === "A" ? [command[4], command[5]] : [command[1], command[2]];
		if (command[0] === "A") points.push(...arcPoints(at, command));
		points.push(end);
		at = end;
	}
	return points;
}

/**
 * Where an arc from the point before it reaches furthest left, right, up or down on its circle,
 * drawn as SVG draws it: a radius too short to reach the end is stretched until it does.
 */
function arcPoints(
	[x1, y1]: Point,
	[, radius, large, sweep, x2, y2]: Arc,
): Point[] {
	const hx = (x1 - x2) / 2;
	const hy = (y1 - y2) / 2;
	const half = hx * hx + hy * hy;
	if (half === 0 || radius === 0) return [];
	const r = Math.max(Math.abs(radius), Math.sqrt(half));
	const toCentre =
		(large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (r * r - half) / half));
	const cx = toCentre * hy + (x1 + x2) / 2;
	const cy = -toCentre * hx + (y1 + y2) / 2;
	const turn = 2 * Math.PI;
	const start = Math.atan2(y1 - cy, x1 - cx);
	const end = Math.atan2(y2 - cy, x2 - cx);
	// How far it turns from the start, clockwise for a sweep of 1 and anticlockwise for 0.
	const swept = (((sweep ? end - start : start - end) % turn) + turn) % turn;
	const points: Point[] = [];
	for (let quarter = 0; quarter < 4; quarter++) {
		const angle = (quarter * Math.PI) / 2;
		const from =
			(((sweep ? angle - start : start - angle) % turn) + turn) % turn;
		if (from <= swept)
			points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
	}
	return points;
}
