import { readdirSync, readFileSync } from "node:fs";
import type { Font, PathCommand } from "opentype.js/dist/opentype.mjs";
import { expect, test, vi } from "vitest";
import { readFace } from "../../../scripts/font-tables";
import {
	figureStillSvg,
	gelStillSvg,
	plateStillSvg,
	stillSvg,
} from "../../../src/viewer/index";
import { twoDecimals } from "../../../src/viewer/scene";
import {
	FACES,
	type Face,
	type Place,
	places,
} from "../../../src/viewer/text/faces";
import { outlineOf } from "../../../src/viewer/text/text";

const recorded = vi.hoisted(() => ({
	advances: new Map<string, [string, Face, number, number]>(),
	places: new Map<string, [string, Face]>(),
}));

// Every width and place the layout asks the table for, with the table's answer.
vi.mock("../../../src/viewer/text/faces", async (importOriginal) => {
	const real =
		await importOriginal<typeof import("../../../src/viewer/text/faces")>();
	return {
		...real,
		advance(text: string, face: Face, size: number) {
			const width = real.advance(text, face, size);
			recorded.advances.set(JSON.stringify([text, face, size]), [
				text,
				face,
				size,
				width,
			]);
			return width;
		},
		places(text: string, face: Face) {
			recorded.places.set(JSON.stringify([text, face]), [text, face]);
			return real.places(text, face);
		},
	};
});

function inputs<Input = { cuts?: { enzyme: string }[] }>(
	folder: string,
): Input[] {
	return readdirSync(`tests/${folder}`)
		.filter((name) => name.endsWith(".json"))
		.map((name) => JSON.parse(readFileSync(`tests/${folder}/${name}`, "utf8")));
}

for (const record of inputs("records")) {
	stillSvg(record);
	stillSvg(record, { sequence_view: true });
	stillSvg(record, {
		enzymes: [...new Set(record.cuts?.map((cut) => cut.enzyme))],
	});
}
for (const gel of inputs("gels")) gelStillSvg(gel);
for (const plate of inputs("plates")) plateStillSvg(plate);
for (const { records, options } of inputs<{
	records: string[];
	options: unknown;
}>("figures")) {
	figureStillSvg(
		records.map((name) =>
			JSON.parse(readFileSync(`tests/records/${name}.json`, "utf8")),
		),
		options,
	);
}

const fonts = Object.fromEntries(
	FACES.map((face) => [face, readFace(face)]),
) as Record<Face, Font>;
const kerned = { script: "latn" };

test("measures every text the test inputs lay out as opentype.js does", () => {
	const advances = [...recorded.advances.values()];
	expect(advances.length).toBeGreaterThan(100);
	for (const [text, face, size, width] of advances)
		expect(width, `${face} ${size} ${text}`).toBe(
			fonts[face].getAdvanceWidth(text, size, kerned),
		);
});

test("places the glyphs of every text the test inputs lay out as opentype.js does", () => {
	const texts = new Map<string, [string, Face]>();
	for (const [text, face] of recorded.advances.values())
		texts.set(JSON.stringify([text, face]), [text, face]);
	for (const [text, face] of recorded.places.values())
		texts.set(JSON.stringify([text, face]), [text, face]);
	expect([...texts.values()].some(([, face]) => face === "mono")).toBe(true);
	for (const [text, face] of texts.values()) {
		const font = fonts[face];
		const expected: Place[] = [];
		font.forEachGlyph(text, 0, 0, font.unitsPerEm, kerned, (glyph, x) =>
			expected.push({
				index: glyph.index,
				x,
				advance: glyph.advanceWidth ?? 0,
			}),
		);
		expect(places(text, face), `${face} ${text}`).toEqual(expected);
	}
});

test("outlines every glyph of each face as opentype.js does, every number with two decimals", () => {
	const d = (commands: PathCommand[]) =>
		commands
			.map((c) => {
				if (c.type === "Z") return "Z";
				const numbers =
					c.type === "Q"
						? [c.x1, c.y1, c.x, c.y]
						: c.type === "C"
							? [c.x1, c.y1, c.x2, c.y2, c.x, c.y]
							: [c.x, c.y];
				return c.type + numbers.map(twoDecimals).join(" ");
			})
			.join("");
	for (const [face, font] of Object.entries(fonts) as [Face, Font][])
		for (let index = 0; index < font.glyphs.length; index++)
			expect(outlineOf(face, index), `${face} ${index}`).toBe(
				d(font.glyphs.get(index).getPath(0, 0, font.unitsPerEm).commands),
			);
});
