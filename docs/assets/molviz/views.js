// Draws each `[data-molviz]` element of a page from the data it holds. Listed after `viewer.js`,
// which sets the global `molviz`. A drawing that fails says why in its place, and the rest still
// draw.

// The views a slot can name in `data-molviz`, each with the call that draws it and the data it
// hands that call, in order. A slot that names none is a line map.
const views = {
	"": ["draw", "record", "options"],
	gel: ["drawGel", "gel"],
};

for (const element of document.querySelectorAll("[data-molviz]")) {
	const [call, ...names] = views[element.dataset.molviz] ?? [];
	const data = (name) => {
		const script = element.querySelector(`script[data-${name}]`);
		return script ? JSON.parse(script.textContent) : undefined;
	};
	try {
		molviz[call](element, ...names.map(data));
	} catch (error) {
		const message = document.createElement("p");
		message.textContent = `This ${names[0] ?? "drawing"} could not be drawn. ${error instanceof Error ? error.message : error}`;
		element.append(message);
	}
}
