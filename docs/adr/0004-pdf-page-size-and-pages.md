---
search:
  exclude: true
---

# A drawing's PDF page is its own size, and the viewer hands Python its pages

A drawing's SVG gives its `width` and `height` with no unit, and one unit is one point. Its PDF
page is exactly that size, and its PNG at `dpi` is that size in print. The PDF drops into a
figure with no cropping and no white margin, and shows the same in every PDF reader. Printing
it on paper takes the reader's "fit to page".

`molviz.svg(record, options)` returns `{svg, pages, hidden, notice}`. Python writes `svg`, the
whole drawing, as `.svg` and `.png`. `pages` holds one SVG per PDF page, the map first, and
Python converts each with vl-convert. The viewer decides the paging, so Python holds no layout.
A drawing with no sequence view has one page, its `svg`.

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
- Joining pages into one PDF needs a library this package does not carry, so a drawing with a
  second page cannot be written as a PDF until it does.
