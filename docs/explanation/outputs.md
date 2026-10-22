# Pages, files and still drawings

molviz writes a drawing in three forms: a page that a browser draws, a file, and a still drawing
for a page of your own. All three draw the same picture, laid out by the same code. They differ
in what a reader can do with the drawing and in where it can go.

## A page is for a reader with a browser

A drawing's `write("map.html")` writes a page: one HTML file that opens offline in any browser. It loads
nothing over the network. The fonts are inside it, and so is everything it draws. You can send
it by email or attach it to a lab notebook entry, and it opens with nothing else installed.

A record's page also carries the viewer, the script that lays the record out and draws it when
the page opens. The reader can then flip a circular record between the circle and the line,
switch kinds, feature types and enzymes on and off, zoom, turn the circle, show the bases, and
select and copy them. Every item stays in the page behind its switch, even one the options
turned off, so the reader can bring it back. Each base and each label is real text, so the
browser's find works on it.

A gel, a plate or a figure has nothing to switch, so its page holds a still drawing and no
viewer. That keeps the page small.

## A file is for slides, papers and print

An `.svg`, `.png` or `.pdf` file holds the drawing itself. Python writes it with no browser. It
runs the viewer's own code inside Python, then turns the SVG into a PNG or a PDF. A file and a
page are laid out by the same code, so a script with no screen draws the map you see in a
browser.

A file differs from a page in three ways:

- It draws only what is on. An item the options leave out, such as the primers when
  `kinds_off` names them, is not in the file at all.
- Each letter is an outline, not text. The file looks the same in every program and needs no
  font, but you cannot search or copy its text.
- Nothing in it can be switched or zoomed. Its hidden labels stay hidden, and the drawing's
  `hidden` lists them.

Each format has its use:

- **SVG** to edit in a drawing program such as Inkscape or Illustrator, or to show as a picture
  in a web page.
- **PDF** for papers and reports, since it stays sharp at any size. Its page is the drawing's
  own size, with no margin, so it drops into a figure with nothing to crop. To print it on
  paper, use the "fit to page" setting of your PDF reader. A record drawn with its sequence
  view has the map on the first page and the rows of bases on the pages after it.
- **PNG** for slides and for anything that takes only pictures, at the `dpi` you ask for. molviz
  refuses a PNG of a very large drawing at a high `dpi`, and its message points you to the PDF,
  which has no such limit.

## A still drawing is for a page of your own

A still drawing is SVG with real text and no viewer, written into a page. It is laid out once,
so it cannot be zoomed or switched. Its text can be found and copied. It draws in molviz's
fonts once the page holds the font rules, which `molviz.font_rules()` returns. One copy of the
font rules serves every still drawing on the page.

`still_svg()` returns a drawing in this form. It suits a page that holds many drawings, such as
a protocol with a figure beside each step. Each drawing adds only its own SVG to the page, and the
page carries no viewer. To draw a record live in your own page instead, put the viewer's script,
which `molviz.viewer_script()` returns, into the page and call the viewer's draw function.

The first map below is live: try its switches. The second is the same record as a still
drawing.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
</div>

<div data-molviz data-still>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
</div>

## The same input writes the same bytes

The same input and options write the same bytes, every time, on macOS and on Linux. A drawing
you keep in a repository then changes only when its input or molviz changes. A test can compare
a new drawing with the one written before.

## Choose by who reads it

| Who reads it | What to write |
| --- | --- |
| Someone who wants to explore the record | a page, `.html` |
| An audience in a talk | `.png`, or `.pdf` if your slides take it |
| A reader of a paper or a report | `.pdf`, or `.svg` to edit first |
| A visitor to your own page | a still drawing, or the viewer for a live record |
