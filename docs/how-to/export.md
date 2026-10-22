# Export SVG, PNG and PDF

Write a drawing to a file to put it in slides, a paper or a report. Each draw call returns a
drawing, and the drawing's `write` picks the file's format from its ending. Python writes the
file on its own, with no browser and no network.

## Draw what you want to export

These examples draw pUC19-GFP, the pUC19 vector with GFP put in by Golden Gate assembly. Save its
record,
[puc19-gfp-product.json](https://raw.githubusercontent.com/liuhlab/liulab-molviz/main/tests/records/puc19-gfp-product.json),
beside your script, or use a record of your own.

```python
import json
from pathlib import Path

import molviz

record = json.loads(Path("puc19-gfp-product.json").read_text())
drawing = molviz.draw(record)
```

A gel, a plate or a figure works the same way: `draw_gel`, `draw_plate` and `draw_figure` each
return a drawing too.

## Write the file

Name the file with the ending of the format you want:

```python
drawing.write("puc19-gfp.svg")
drawing.write("puc19-gfp.png")
drawing.write("puc19-gfp.pdf")
```

Each file holds this drawing:

<div data-molviz data-still>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
</div>

Pick the format by where the drawing goes:

- **SVG** for a web page, or to change the drawing in a vector editor such as Inkscape. Its
  letters are drawn as shapes, so it looks the same on a computer that lacks molviz's fonts.
- **PNG** for slides and documents that take an image.
- **PDF** for print and for a paper.

The ending is read in any case, so `.PDF` works too. Any other ending raises `ValueError`.

A file has no bar of switches. It shows the record with the [options](../api.md#options) you passed to `draw`.

## Set the PNG's resolution

`write` draws a PNG at 300 dots per inch (dpi). To change that, pass `dpi`:

```python
drawing.write("puc19-gfp.png", dpi=600)
```

A drawing is measured in points, 72 to the inch, so a PNG prints at the drawing's own size at
any dpi. A higher dpi gives more pixels. If the PNG would be too large, `write` raises
`ValueError`. Write a PDF instead: it stays sharp at any size.

## Export the bases as PDF pages

If the drawing has the sequence view, its PDF puts the map on the first page and the rows of
bases on the pages after:

```python
molviz.draw(record, sequence_view=True).write("puc19-gfp-bases.pdf")
```

Each page is as large as what it holds.

## Write a page instead

To write a page that opens in a browser, end the file's name in `.html`:

```python
drawing.write("puc19-gfp.html")
```

The page opens offline. A record's page draws it with the viewer, so that the reader can turn the
map and switch views. A gel's, a plate's or a figure's page holds its still drawing. To put
several drawings in one page, see [Put drawings in your own page](your-own-page.md).
