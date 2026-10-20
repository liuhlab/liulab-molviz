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
- A record's page, and `molviz.draw`, put a bar of controls above the map. Its switches turn
  each kind, each feature type and each enzyme on or off, and the map is laid out again. The
  enzymes fold into a list, each with how many times it cuts. Circle and Line flip a whole
  circular record, and Sequence shows the sequence view. The slider, or Ctrl or ⌘ with the
  wheel, zooms the map from 1× to 8× about the pointer, and a zoomed map scrolls in its box.
  The wheel turns the circle. Reset goes back to 1×, with the origin at the top. Resting the
  pointer on an item shows its name, type, span and length at once. A print leaves out the
  bar and prints the map at 1×, with the switches and the turn as they are.
- On a record's page, and with `molviz.draw`, the map and the sequence view are linked. Click a
  feature, a primer or a cut site in either view to select its bases. They are shaded in both
  views, and the sequence view scrolls to them, as does a zoomed map. A drag across the map or
  across the bases selects a stretch, and a drag on the circle may cross the origin. The
  sequence view's bar says what is selected, and its Copy button puts the top strand's selected
  bases on the clipboard, as the copy keys do. Resting the pointer on an item in the sequence
  view shows the same box as on the map, and on a base its position. Both strands hides the
  bottom strand, and the rows keep its room. The sequence view sits beside the map when the
  window has room for both at full size, and under it otherwise, with rows half as long when
  full ones do not fit. A print shows it under the map with full rows, and the selection as it
  is.

- The package carries a second script, the outline script, beside the viewer. It holds the
  shape of each letter, which a file draws.
- In the viewer, `molviz.svg`, `molviz.gelSvg`, `molviz.plateSvg` and `molviz.figureSvg` need
  the outline script run beside the viewer, and throw an error without it. Drawing on a page
  and the still calls need only the viewer.
- The viewer measures text from tables made from its fonts when it is built, and a page loads
  the fonts as WOFF2. Its script is about a third of the size it was, and every drawing is
  the same.
- A record may hold reads, disagreements and tracks.
  - A read is one sequencing result: its name, the bases it covers, and its strand.
  - A disagreement is a place where reads differ from the record. It lies over a span, or at a
    point where the reads add bases. It gives the bases the reads hold there, which may be none,
    the names of the reads that show it, and a colour, grey by default.
  - A track is a trace's four curves, `A`, `C`, `G` and `T`, and its peaks. A peak says which
    sample lies over which base.
  - `check` refuses two reads with one name, and a disagreement that names a read the record
    does not hold.
  - `kinds_off` takes `"reads"`, `"disagreements"` and `"tracks"`, and `highlight` takes their
    names.
  - Where labels crowd, a read's label hides after a primer's and before a feature's. A
    disagreement's label hides last. The notice counts them as reads and disagreements.
  - The line and the circle draw a read as they draw a primer, among the primers. A
    disagreement over a span is a bar in its colour among the features. One at a point is a
    mark in its colour, as an insertion's is, labelled with its name.
  - The sequence view draws a read on its strand as it draws a primer. The read marks in red
    each base of a disagreement that names it. A disagreement over a span is a bar among the
    features, and one at a point is a mark through the strands.
  - The sequence view draws each track as a strip under each row its peaks reach: its name,
    the key of its four colours, and its curves. A highlight that names something else dims
    the strip.
- In the viewer, `molviz.declareFaces(document)` adds the font rules to a page once. `draw`
  calls it, and so may a script that writes still drawings into a page.

### Removed

- `greet`, the template's placeholder, and its `molviz greet` command.
