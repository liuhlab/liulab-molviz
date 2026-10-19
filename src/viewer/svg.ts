/**
 * A scene as SVG on a white ground: as text with every letter an outline, so it draws the same
 * with no font, or with its letters as real text, as elements of a page or as text for one.
 */

import { leftEdge, type Scene, type Shape, twoDecimals } from "./scene";
import { family, inFace, measure, outline, weights } from "./text";

const GROUND = "#ffffff";
const NAMESPACE = "http://www.w3.org/2000/svg";

/** How a scene draws its letters. */
type Letters = "outlines" | "text";

type Attributes = readonly (readonly [name: string, value: string])[];

/**
 * One SVG element: its tag, its attributes in the order they are written, its text, and the
 * shape's hover text.
 */
interface Tag {
	readonly name: string;
	readonly attributes: Attributes;
	readonly text?: string;
	readonly hover?: string;
}

/**
 * `scene` as one SVG document, with no hover text. Its width and height have no unit, so one
 * unit is one point. Every number has two decimals, so the same scene gives the same text.
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
 * which are `<text>` in the viewer's faces, and each shape's hover text, a `<title>` in it. The
 * page must declare the faces.
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
		if (tag.hover !== undefined) {
			const title = document.createElementNS(NAMESPACE, "title");
			title.textContent = tag.hover;
			element.append(title);
		}
		svg.append(element);
	}
	return svg;
}

/**
 * `scene` as one SVG document that draws as `toElement` does, for a page to hold as it is: its
 * letters `<text>` in the viewer's faces, each shape's hover text a `<title>` in it. The page
 * must declare the faces.
 */
export function toStill(scene: Scene): string {
	const { root, children } = tags(scene, "text");
	return `<svg xmlns="${NAMESPACE}"${written(root)}>${children.map(markup).join("")}</svg>`;
}

/** The root's attributes, and the elements inside it: the ground, then each shape in order. */
function tags(
	scene: Scene,
	letters: Letters,
): { root: Attributes; children: Tag[] } {
	const { x, y, width, height } = scene.extent;
	const size = [
		["width", twoDecimals(width)],
		["height", twoDecimals(height)],
	] as const;
	const ground: Tag = {
		name: "rect",
		attributes: [
			["x", twoDecimals(x)],
			["y", twoDecimals(y)],
			...size,
			["fill", GROUND],
		],
	};
	return {
		root: [
			...size,
			[
				"viewBox",
				`${twoDecimals(x)} ${twoDecimals(y)} ${twoDecimals(width)} ${twoDecimals(height)}`,
			],
		],
		children: [
			ground,
			...scene.shapes.map((shape) => ({
				...tag(shape, letters),
				hover: shape.hover,
			})),
		],
	};
}

function tag(shape: Shape, letters: Letters): Tag {
	switch (shape.shape) {
		case "line":
			return {
				name: "line",
				attributes: [
					["x1", twoDecimals(shape.x1)],
					["y1", twoDecimals(shape.y1)],
					["x2", twoDecimals(shape.x2)],
					["y2", twoDecimals(shape.y2)],
					...stroke(shape),
				],
			};
		case "polygon": {
			const d = shape.points
				.map(
					([x, y], i) => `${i ? "L" : "M"}${twoDecimals(x)} ${twoDecimals(y)}`,
				)
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
					["x", twoDecimals(shape.x)],
					["y", twoDecimals(shape.y)],
					["width", twoDecimals(shape.width)],
					["height", twoDecimals(shape.height)],
					["rx", twoDecimals(shape.corner)],
					["fill", shape.fill],
					...stroke(shape),
				],
			};
		case "circle":
			return {
				name: "circle",
				attributes: [
					["cx", twoDecimals(shape.cx)],
					["cy", twoDecimals(shape.cy)],
					["r", twoDecimals(shape.r)],
					["fill", shape.fill],
				],
			};
		case "text": {
			const { text, face, size, y, fill } = shape;
			const width = measure(text, face, size);
			const x = leftEdge(shape, width);
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
					["x", twoDecimals(x)],
					["y", twoDecimals(y)],
					["font-family", family],
					["font-size", twoDecimals(size)],
					["font-weight", String(weights[face])],
					// Holds the text to the width the layout measured, in whatever font the browser uses.
					["textLength", twoDecimals(width)],
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
		["stroke-width", twoDecimals(shape.strokeWidth)],
	];
}

/** `tag` as SVG text: its text, then its hover as a `<title>`. */
function markup(tag: Tag): string {
	const open = `<${tag.name}${written(tag.attributes)}`;
	const inside =
		(tag.text === undefined ? "" : escaped(tag.text)) +
		(tag.hover === undefined ? "" : `<title>${escaped(tag.hover)}</title>`);
	return inside ? `${open}>${inside}</${tag.name}>` : `${open}/>`;
}

/** `text` as SVG text that reads back as `text`. */
function escaped(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function written(attributes: Attributes): string {
	return attributes.map(([name, value]) => ` ${name}="${value}"`).join("");
}
