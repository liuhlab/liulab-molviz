/** A scene written as SVG text: every letter an outline, so it draws the same with no font. */

import type { Scene, Shape } from "./line";
import { measure, outline } from "./text";

const GROUND = "#ffffff";

/**
 * `scene` as one SVG document on a white ground. Its width and height have no unit, so one
 * unit is one point. Every number has two decimals, so the same scene gives the same text.
 */
export function toSvg(scene: Scene): string {
	const { x, y, width, height } = scene.extent;
	const size = `width="${n(width)}" height="${n(height)}"`;
	const view = `viewBox="${n(x)} ${n(y)} ${n(width)} ${n(height)}"`;
	const ground = `<rect x="${n(x)}" y="${n(y)}" ${size} fill="${GROUND}"/>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" ${size} ${view}>${ground}${scene.shapes.map(element).join("")}</svg>`;
}

function element(shape: Shape): string {
	switch (shape.shape) {
		case "line":
			return `<line x1="${n(shape.x1)}" y1="${n(shape.y1)}" x2="${n(shape.x2)}" y2="${n(shape.y2)}"${stroke(shape)}/>`;
		case "polygon": {
			const d = shape.points
				.map(([x, y], i) => `${i ? "L" : "M"}${n(x)} ${n(y)}`)
				.join("");
			return `<path d="${d}Z" fill="${shape.fill}"${stroke(shape)}/>`;
		}
		case "rect":
			return `<rect x="${n(shape.x)}" y="${n(shape.y)}" width="${n(shape.width)}" height="${n(shape.height)}" rx="${n(shape.corner)}" fill="${shape.fill}"${stroke(shape)}/>`;
		case "circle":
			return `<circle cx="${n(shape.cx)}" cy="${n(shape.cy)}" r="${n(shape.r)}" fill="${shape.fill}"/>`;
		case "text": {
			const { text, face, size, y } = shape;
			const x =
				shape.anchor === "middle"
					? shape.x - measure(text, face, size) / 2
					: shape.x;
			return `<path d="${outline(text, face, size, x, y)}" fill="${shape.fill}"/>`;
		}
	}
}

function stroke(shape: { stroke: string; strokeWidth: number }): string {
	return ` stroke="${shape.stroke}" stroke-width="${n(shape.strokeWidth)}"`;
}

/** `value` with two decimals, and never as `-0.00`. */
function n(value: number): string {
	const text = value.toFixed(2);
	return text === "-0.00" ? "0.00" : text;
}
