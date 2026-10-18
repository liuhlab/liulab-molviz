// Draws the record held in each `[data-molviz]` element of a page, with the options beside it.
// Listed after `viewer.js`, which sets the global `molviz`. A record that fails to draw says why
// in its place, and the rest still draw.
for (const element of document.querySelectorAll("[data-molviz]")) {
	const data = (name) => {
		const script = element.querySelector(`script[data-${name}]`);
		return script ? JSON.parse(script.textContent) : undefined;
	};
	try {
		molviz.draw(element, data("record"), data("options"));
	} catch (error) {
		const message = document.createElement("p");
		message.textContent = `This record could not be drawn. ${error instanceof Error ? error.message : error}`;
		element.append(message);
	}
}
