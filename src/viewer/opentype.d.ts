// opentype.js ships no types. These cover what the viewer calls.
declare module "opentype.js" {
	export type PathCommand =
		| { type: "M" | "L"; x: number; y: number }
		| { type: "Q"; x1: number; y1: number; x: number; y: number }
		| {
				type: "C";
				x1: number;
				y1: number;
				x2: number;
				y2: number;
				x: number;
				y: number;
		  }
		| { type: "Z" };

	export interface RenderOptions {
		script?: string;
	}

	export interface Font {
		ascender: number;
		descender: number;
		unitsPerEm: number;
		hasChar(character: string): boolean;
		getAdvanceWidth(
			text: string,
			fontSize: number,
			options?: RenderOptions,
		): number;
		getPath(
			text: string,
			x: number,
			y: number,
			fontSize: number,
			options?: RenderOptions,
		): { commands: PathCommand[] };
	}

	export function parse(buffer: ArrayBuffer): Font;
}
