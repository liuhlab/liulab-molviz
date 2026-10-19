# Changelog

Every change worth knowing about, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version numbers are CalVer tags
of the form `vYYYY.M.PATCH`, and the tag is where the version comes from — nothing here
sets one.

## [Unreleased]

### Added

- The viewer: a JavaScript file built from TypeScript and shipped inside the package.
- `viewer_script()` returns the viewer's text, for a page to inline.
- `check(record)` checks a record against the format.
- `draw(record, **options)` checks a record and the options for drawing it, and returns a
  `Drawing` of the record as a circle or a line map. Its `map` option is `"circle"` or
  `"line"`. A circular record drawn whole is drawn as a circle unless `map="line"` asks for
  the line. The circle of a linear record, or of a `span` short of the whole record, is an
  error.
- `Drawing.write(path, dpi=300)` writes the drawing in the format its ending names: `.html`,
  a page that draws the record offline; `.svg`; `.png`, at `dpi` pixels per inch; or `.pdf`.
- In the viewer, `molviz.draw(element, record, options)` draws a record into an element of a
  page. `molviz.svg(record, options)` returns the drawing as `{svg, pages, hidden, notice}`:
  its SVG text, one SVG for each PDF page, the hidden labels, and the notice.
- `check_gel(gel)` checks a gel against the gel format: a ladder and its lanes, each band by
  its size in bp.
- `draw_gel(gel)` checks a gel and returns a `Drawing` of it, which writes the same four
  endings as a record's. Its `hidden` is empty and its `notice` blank.
- In the viewer, `molviz.checkGel(gel)` checks a gel, and `molviz.drawGel(element, gel)` draws
  it into an element of a page. `molviz.gelSvg(gel)` returns the drawing as
  `{svg, pages, hidden, notice}`, as `molviz.svg` does. On a page, resting the pointer on a
  band shows its size.
- `check_plate(plate)` checks a plate against the plate format: its rows and columns, and the
  contents of each well by its name, such as `B3`.
- `draw_plate(plate)` checks a plate and returns a `Drawing` of it, which writes the same four
  endings as a record's. Its `hidden` is empty and its `notice` blank.
- In the viewer, `molviz.checkPlate(plate)` checks a plate, and
  `molviz.drawPlate(element, plate)` draws it into an element of a page.
  `molviz.plateSvg(plate)` returns the drawing as `{svg, pages, hidden, notice}`, as
  `molviz.svg` does. On a page, resting the pointer on a well shows its name and its contents.
- `draw_figure(records, **options)` checks records and the options they share, and returns a
  `Drawing` of them stacked top to bottom, which writes the same four endings as a record's.
  Each is drawn on the map `draw` gives it, and a circle is centred on the lines.
  When two or more stack, each has its name above it. A name to highlight lights what answers
  to it in every record, and a record with nothing lit is dimmed whole. With the sequence view,
  each record's rows sit under its map, and a PDF has the maps on its first page, then each
  record's rows on the pages after.
- In the viewer, `molviz.checkFigure(records)` checks a figure's records,
  `molviz.drawFigure(element, records, options)` draws them into an element of a page, and
  `molviz.figureSvg(records, options)` returns the drawing as `{svg, pages, hidden, notice}`.
- In the viewer, `molviz.calls` names the calls for each input, `record`, `gel`, `plate` or
  `figure`: the one that checks it, the one that draws it into an element, and the one that
  returns SVG.
- `Drawing.still_svg()` returns the drawing as SVG with real text, for a page with no
  viewer. It is laid out as the `.svg` file is and hides the same labels; each hover is a
  tooltip. `font_rules()` returns the CSS such a page writes once, in a `<style>` element,
  to load the viewer's fonts.
- In the viewer, `molviz.stillSvg(record, options)`, `molviz.gelStillSvg(gel)`,
  `molviz.plateStillSvg(plate)` and `molviz.figureStillSvg(records, options)` return a still
  drawing as `{svg, hidden, notice}`, and `molviz.fontRules()` returns the font rules.
  `molviz.calls` names each input's still call.
- A gel's, a plate's or a figure's `.html` page holds its still drawing and the font rules,
  and no viewer. A record's page still draws it with the viewer.
- A new runtime dependency: vl-convert-python, which writes PNG and PDF.
- `draw(record, sequence_view=True)` draws the sequence view under the map: the bases in rows
  on both strands, with what is drawn on them. `bases_per_row` sets a row's length, and
  `bottom_strand=False` leaves the bottom strand out. It draws at most
  `SEQUENCE_VIEW_LIMIT` bases, 100,000. A PDF of it has the map on its first page and the rows
  on the pages after, joined by pypdf, a new runtime dependency.
- `Drawing.write` refuses a PNG past 2**22 pixels on a side or 2**28 in all, and says to write
  a PDF instead.
- In the viewer, `molviz.SEQUENCE_VIEW_LIMIT`, and the sequence view drawn under the map by
  `molviz.draw` and `molviz.svg`. Past the limit `molviz.draw` and `molviz.drawFigure` leave
  the view out, and `molviz.svg`, `molviz.figureSvg` and the still calls raise an error.
- On a linear record, a feature may run off the end and on from the start, once: one of its
  segments may start lower than the one before it. The map and the sequence view draw each
  piece where it lies, with a grey join to the end it meets.

- The package carries a second script, the outline script, beside the viewer. It holds the
  shape of each letter, which a file draws.
- In the viewer, `molviz.svg`, `molviz.gelSvg`, `molviz.plateSvg` and `molviz.figureSvg` need
  the outline script run beside the viewer, and throw an error without it. Drawing on a page
  and the still calls need only the viewer.
- The viewer measures text from tables made from its fonts when it is built, and a page loads
  the fonts as WOFF2. Its script is about a third of the size it was, and every drawing is
  the same.

### Removed

- `greet`, the template's placeholder, and its `molviz greet` command.
