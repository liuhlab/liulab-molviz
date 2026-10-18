/**
 * A scene as SVG on a white ground: as text with every letter an outline, so it draws the same
 * with no font, or as elements of a page with its letters as real text.
 */

import type { Scene, Shape } from "./line";
import { family, inFace, measure, outline, weights } from "./text";

const GROUND = "#ffffff";
const NAMESPACE = "http://www.w3.org/2000/svg";

/** How a scene draws its letters. */
type Letters = "outlines" | "text";

type Attributes = readonly (readonly [name: string, value: string])[];

/** One SVG element: its tag, its attributes in the order they are written, and its text. */
interface Tag {
	readonly name: string;
	readonly attributes: Attributes;
	readonly text?: string;
}

/**
 * `scene` as one SVG document. Its width and height have no unit, so one unit is one point.
 * Every number has two decimals, so the same scene gives the same text.
 */
export function toSvg(scene: Scene): string {
	const { root, children } = tags(scene, "outlines");
	const inside = children
		.map((tag) => `<${tag.name}${written(tag.attributes)}/>`)
		.join("");
	return `<svg xmlns="${NAMESPACE}"${written(root)}>${inside}</svg>`;
}

/**
 * `scene` as an `<svg>` element of `document`, the same as `toSvg` writes but for its letters,
 * which are `<text>` in the viewer's faces. The page must declare the faces.
 */
export function toElement(scene: Scene, document: Document): SVGSVGElement {
	const { root, children } = tags(scene, "text");
	const svg = document.createElementNS(NAMESPACE, "svg");
	for (const [name, value] of root) svg.setAttribute(name, value);
	for (const tag of children) {
		const element = document.createElementNS(NAMESPACE, tag.name);
		for (const [name, value] of tag.attributes)
			element.setAttribute(name, value);
		if (tag.text !== undefined) element.textContent = tag.text;
		svg.append(element);
	}
	return svg;
}

/** The root's attributes, and the elements inside it: the ground, then each shape in order. */
function tags(
	scene: Scene,
	letters: Letters,
): { root: Attributes; children: Tag[] } {
	const { x, y, width, height } = scene.extent;
	const size = [
		["width", n(width)],
		["height", n(height)],
	] as const;
	const ground: Tag = {
		name: "rect",
		attributes: [["x", n(x)], ["y", n(y)], ...size, ["fill", GROUND]],
	};
	return {
		root: [...size, ["viewBox", `${n(x)} ${n(y)} ${n(width)} ${n(height)}`]],
		children: [ground, ...scene.shapes.map((shape) => tag(shape, letters))],
	};
}

function tag(shape: Shape, letters: Letters): Tag {
	switch (shape.shape) {
		case "line":
			return {
				name: "line",
				attributes: [
					["x1", n(shape.x1)],
					["y1", n(shape.y1)],
					["x2", n(shape.x2)],
					["y2", n(shape.y2)],
					...stroke(shape),
				],
			};
		case "polygon": {
			const d = shape.points
				.map(([x, y], i) => `${i ? "L" : "M"}${n(x)} ${n(y)}`)
				.join("");
			return {
				name: "path",
				attributes: [["d", `${d}Z`], ["fill", shape.fill], ...stroke(shape)],
			};
		}
		case "rect":
			return {
				name: "rect",
				attributes: [
					["x", n(shape.x)],
					["y", n(shape.y)],
					["width", n(shape.width)],
					["height", n(shape.height)],
					["rx", n(shape.corner)],
					["fill", shape.fill],
					...stroke(shape),
				],
			};
		case "circle":
			return {
				name: "circle",
				attributes: [
					["cx", n(shape.cx)],
					["cy", n(shape.cy)],
					["r", n(shape.r)],
					["fill", shape.fill],
				],
			};
		case "text": {
			const { text, face, size, y, fill } = shape;
			const width = measure(text, face, size);
			const x = shape.anchor === "middle" ? shape.x - width / 2 : shape.x;
			if (letters === "outlines") {
				return {
					name: "path",
					attributes: [
						["d", outline(text, face, size, x, y)],
						["fill", fill],
					],
				};
			}
			return {
				name: "text",
				attributes: [
					["x", n(x)],
					["y", n(y)],
					["font-family", family],
					["font-size", n(size)],
					["font-weight", String(weights[face])],
					// Holds the text to the width the layout measured, in whatever font the browser uses.
					["textLength", n(width)],
					["fill", fill],
				],
				text: inFace(text, face),
			};
		}
	}
}

function stroke(shape: { stroke: string; strokeWidth: number }): Attributes {
	return [
		["stroke", shape.stroke],
		["stroke-width", n(shape.strokeWidth)],
	];
}

function written(attributes: Attributes): string {
	return attributes.map(([name, value]) => ` ${name}="${value}"`).join("");
}

/** `value` with two decimals, and never as `-0.00`. */
function n(value: number): string {
	const text = value.toFixed(2);
	return text === "-0.00" ? "0.00" : text;
}
