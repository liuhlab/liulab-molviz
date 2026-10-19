// Draws each `[data-molviz]` element of a page from the data it holds. Listed after `viewer.js`,
// which sets the global `molviz`. A drawing that fails says why in its place, and the rest still
// draw.

// A slot names its input in `data-molviz`, or names none for a record. It holds the input in a
// JSON block of the same name, and any options in one named `options`. A slot marked
// `data-still` holds the still drawing, and the page the font rules once.
for (const element of document.querySelectorAll("[data-molviz]")) {
	const name = element.dataset.molviz || "record";
	const data = (block) => {
		const script = element.querySelector(`script[data-${block}]`);
		return script ? JSON.parse(script.textContent) : undefined;
	};
	try {
		if (!Object.hasOwn(molviz.calls, name)) {
			const known = Object.keys(molviz.calls).join(", ");
			throw new Error(`The viewer draws no "${name}", only ${known}.`);
		}
		const calls = molviz.calls[name];
		if (!("still" in element.dataset)) {
			molviz[calls.draw](element, data(name), data("options"));
			continue;
		}
		const { svg } = molviz[calls.still](data(name), data("options"));
		// The id of the viewer's own font rules, so live and still drawings share one copy.
		if (!document.getElementById("molviz-fonts")) {
			const style = document.createElement("style");
			style.id = "molviz-fonts";
			style.textContent = molviz.fontRules();
			document.head.append(style);
		}
		element.insertAdjacentHTML("beforeend", svg);
	} catch (error) {
		const message = document.createElement("p");
		message.textContent = `This ${name} could not be drawn. ${error instanceof Error ? error.message : error}`;
		element.append(message);
	}
}
