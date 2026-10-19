/**
 * A scene as SVG on a white ground: as text with every letter an outline, so it draws the same
 * with no font, or with its letters as real text, as elements of a page or as text for one.
 */

import {
	leftEdge,
	type PathCommand,
	type Scene,
	type Shape,
	twoDecimals,
} from "./scene";
import {
	type Face,
	families,
	glyphs,
	inFace,
	textWidth,
	unitsPerEm,
	weights,
} from "./text";

const GROUND = "#ffffff";
const NAMESPACE = "http://www.w3.org/2000/svg";
// A use names its glyph by `xlink:href`, not SVG 2's `href`, which SVG 1.1 readers such as
// Illustrator skip.
const XLINK = "http://www.w3.org/1999/xlink";

/** The outline of each glyph a scene draws, by its id, when its letters are outlines. */
type Defined = Map<string, string>;

type Attributes = readonly (readonly [name: string, value: string])[];

/**
 * One SVG element: its tag, its attributes in the order they are written, its text or the
 * elements inside it, and the shape's hover text.
 */
interface Tag {
	readonly name: string;
	readonly attributes: Attributes;
	readonly text?: string;
	readonly children?: readonly Tag[];
	readonly hover?: string;
}

/**
 * `scene` as one SVG document, with no hover text. Its width and height have no unit, so one
 * unit is one point. Each glyph is defined once and used for every letter it draws. Every
 * number has two decimals but a glyph's scale, so the same scene gives the same text.
 */
export function toSvg(scene: Scene): string {
	const { root, children } = tags(scene, new Map());
	const inside = children.map(({ hover, ...tag }) => markup(tag)).join("");
	return `<svg xmlns="${NAMESPACE}" xmlns:xlink="${XLINK}"${written(root)}>${inside}</svg>`;
}

/**
 * `scene` as an `<svg>` element of `document`, the same as `toSvg` writes but for its letters,
 * which are `<text>` in the viewer's faces, and each shape's hover text, a `<title>` in it. The
 * page must declare the faces.
 */
export function toElement(scene: Scene, document: Document): SVGSVGElement {
	const { root, children } = tags(scene);
	const svg = document.createElementNS(NAMESPACE, "svg");
	for (const [name, value] of root) svg.setAttribute(name, value);
	svg.append(...children.map((tag) => element(tag, document)));
	return svg;
}

/**
 * `scene` as one SVG document that draws as `toElement` does, for a page to hold as it is: its
 * letters `<text>` in the viewer's faces, each shape's hover text a `<title>` in it. The page
 * must declare the faces.
 */
export function toStill(scene: Scene): string {
	const { root, children } = tags(scene);
	return `<svg xmlns="${NAMESPACE}"${written(root)}>${children.map(markup).join("")}</svg>`;
}

/**
 * The root's attributes, and the elements inside it: the glyphs `defined`, if letters are
 * outlines, then the ground, then each shape in order.
 */
function tags(
	scene: Scene,
	defined?: Defined,
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
	const shapes = scene.shapes.map((shape) => ({
		...tag(shape, defined),
		hover: shape.hover,
	}));
	const defs: Tag[] = defined?.size
		? [
				{
					name: "defs",
					attributes: [],
					children: [...defined].map(([id, d]) => ({
						name: "path",
						attributes: [
							["id", id],
							["d", d],
						],
					})),
				},
			]
		: [];
	return {
		root: [
			...size,
			[
				"viewBox",
				`${twoDecimals(x)} ${twoDecimals(y)} ${twoDecimals(width)} ${twoDecimals(height)}`,
			],
		],
		children: [...defs, ground, ...shapes],
	};
}

/** `shape` as SVG, its letters as uses of the glyphs it adds to `defined`, or else as text. */
function tag(shape: Shape, defined?: Defined): Tag {
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
		case "path":
			return {
				name: "path",
				attributes: [
					["d", shape.commands.map(step).join("")],
					["fill", shape.fill],
					...stroke(shape),
				],
			};
		case "letters": {
			const { text, face, size, fill, places } = shape;
			if (defined) {
				return {
					name: "g",
					attributes: [["fill", fill]],
					children: [...text].flatMap(
						(letter, i) => glyph(letter, face, size, places[i], defined) ?? [],
					),
				};
			}
			const list = (i: 0 | 1 | 2) =>
				places.map((place) => twoDecimals(place[i])).join(" ");
			return {
				name: "text",
				attributes: [
					["x", list(0)],
					["y", list(1)],
					["rotate", list(2)],
					["font-family", families[face]],
					["font-size", twoDecimals(size)],
					["font-weight", String(weights[face])],
					["fill", fill],
				],
				text: inFace(text, face),
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
			const { text, face, size, y, fill, cell } = shape;
			const width = textWidth(text, face, size, cell);
			const x = leftEdge(shape, width);
			if (defined) {
				// A glyph's outline is in its face's units; the group scales it to the text's size.
				const scale = size / unitsPerEm(face);
				const uses: Tag[] = [];
				for (const glyph of glyphs(text, face, size, cell)) {
					if (!glyph.outline) continue;
					defined.set(glyph.id, glyph.outline);
					uses.push({
						name: "use",
						attributes: [
							["xlink:href", `#${glyph.id}`],
							["x", twoDecimals(glyph.x / scale)],
						],
					});
				}
				const at = `translate(${twoDecimals(x)} ${twoDecimals(y)}) scale(${scale})`;
				return {
					name: "g",
					attributes: [
						["transform", [...turn(shape), at].join(" ")],
						["fill", fill],
					],
					children: uses,
				};
			}
			const places =
				cell === undefined
					? twoDecimals(x)
					: glyphs(text, face, size, cell)
							.map((glyph) => twoDecimals(x + glyph.x))
							.join(" ");
			return {
				name: "text",
				attributes: [
					["x", places],
					["y", twoDecimals(y)],
					["font-family", families[face]],
					["font-size", twoDecimals(size)],
					["font-weight", String(weights[face])],
					// Holds the text to the width the layout measured, in whatever font the browser uses.
					...(cell === undefined
						? ([["textLength", twoDecimals(width)]] as const)
						: []),
					["fill", fill],
					...turn(shape).map((rotation) => ["transform", rotation] as const),
				],
				text: inFace(text, face),
			};
		}
	}
}

/** The rotation turning text about its `x` and `y`, or none if it does not turn. */
function turn({ x, y, rotate }: Extract<Shape, { shape: "text" }>): string[] {
	if (rotate === undefined) return [];
	return [`rotate(${twoDecimals(rotate)} ${twoDecimals(x)} ${twoDecimals(y)})`];
}

/**
 * A use of one letter's glyph, which it adds to `defined`, starting at `x` and `y` on its
 * baseline and turned `rotate` degrees clockwise there; `null` for a letter with no ink.
 */
function glyph(
	letter: string,
	face: Face,
	size: number,
	[x, y, rotate]: readonly [number, number, number],
	defined: Defined,
): Tag | null {
	const [first] = glyphs(letter, face, size);
	if (!first?.outline) return null;
	defined.set(first.id, first.outline);
	const at = `translate(${twoDecimals(x)} ${twoDecimals(y)}) rotate(${twoDecimals(rotate)})`;
	return {
		name: "use",
		attributes: [
			["xlink:href", `#${first.id}`],
			["transform", `${at} scale(${size / unitsPerEm(face)})`],
		],
	};
}

/** One step of a path as path data, every number with two decimals. */
function step(command: PathCommand): string {
	switch (command[0]) {
		case "Z":
			return "Z";
		case "A": {
			const [, r, large, sweep, x, y] = command;
			return `A${twoDecimals(r)} ${twoDecimals(r)} 0 ${large} ${sweep} ${twoDecimals(x)} ${twoDecimals(y)}`;
		}
		default: {
			const [letter, x, y] = command;
			return `${letter}${twoDecimals(x)} ${twoDecimals(y)}`;
		}
	}
}

function stroke(shape: { stroke: string; strokeWidth: number }): Attributes {
	return [
		["stroke", shape.stroke],
		["stroke-width", twoDecimals(shape.strokeWidth)],
	];
}

/** `tag` as SVG text: its text, then the elements inside it, then its hover as a `<title>`. */
function markup(tag: Tag): string {
	const open = `<${tag.name}${written(tag.attributes)}`;
	const inside =
		(tag.text === undefined ? "" : escaped(tag.text)) +
		(tag.children ?? []).map(markup).join("") +
		(tag.hover === undefined ? "" : `<title>${escaped(tag.hover)}</title>`);
	return inside ? `${open}>${inside}</${tag.name}>` : `${open}/>`;
}

function element(tag: Tag, document: Document): Element {
	const out = document.createElementNS(NAMESPACE, tag.name);
	for (const [name, value] of tag.attributes) out.setAttribute(name, value);
	if (tag.text !== undefined) out.textContent = tag.text;
	for (const child of tag.children ?? []) out.append(element(child, document));
	if (tag.hover !== undefined) {
		const title = document.createElementNS(NAMESPACE, "title");
		title.textContent = tag.hover;
		out.append(title);
	}
	return out;
}

/** `text` as SVG text that reads back as `text`, in an element or a quoted attribute. */
function escaped(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function written(attributes: Attributes): string {
	return attributes
		.map(([name, value]) => ` ${name}="${escaped(value)}"`)
		.join("");
}
