---
search:
  exclude: true
---

# A drawing's PDF page is its own size, and the viewer hands Python its pages

A drawing's SVG gives its `width` and `height` with no unit, and one unit is one point. Its PDF
page is exactly that size, and its PNG at `dpi` is that size in print. The PDF drops into a
figure with no cropping and no white margin, and shows the same in every PDF reader. Printing
it on paper takes the reader's "fit to page".

`molviz.svg(record, options)` returns `{svg, pages, hidden, notice}`. `svg` is the whole
drawing: the map, with the sequence view under it when drawn, the narrower centred under the
wider. Python writes it as `.svg` and `.png`. `pages` holds one SVG per PDF page: the map first,
then the sequence view's rows. A row page is as wide as the view and holds as many whole rows as
fit in √2 times that width, the shape of A4. A row taller than that stands alone. Python
converts each page with vl-convert and joins them with pypdf. The viewer decides the paging, so
Python holds no layout. A drawing with no sequence view has one page, its `svg`.

## Considered options

- **An A4 or Letter page with margins.** It prints at full size, but the line map is wider than
  A4 in portrait, so it would shrink with its text or turn landscape. A4 against Letter is a
  preference no source settles.
- **A separate `molviz.pages(...)` call.** It lays the drawing out a second time.
- **One SVG with a group per page, for Python to split.** Knowing where a page ends is layout,
  which belongs to the viewer.

## Consequences

- The pages of one PDF can differ in size.
- A one-page drawing crosses from the viewer with its SVG twice.
- A PDF of more than one page is joined by pypdf. A one-page PDF skips it and keeps
  vl-convert's own bytes.
- A PNG past 2²² pixels on a side or 2²⁸ in all is refused, and the message points at the PDF,
  which has no such limit.
