/** The viewer. The build exposes each export here on the global `molviz`. */

export { check } from "./record";
export { measure } from "./text";

/** Return a greeting addressed to `name`: the placeholder the first view replaces. */
export function greet(name = "world"): string {
	return `Hello, ${name}!`;
}
