# Export SVG, PNG and PDF

Write a drawing to a file to put it in slides, a paper or a report. Each draw call returns a
drawing, and the drawing's [`write`](../api.md#molviz.Drawing.write) picks the file's format
from its ending. Python writes the
file on its own, with no browser and no network.

## Draw what you want to export

These examples draw pUC19-GFP, the pUC19 vector with GFP put in by Golden Gate assembly. Save
its record, [`puc19-gfp-product.json`](https://raw.githubusercontent.com/liuhlab/liulab-molviz/main/tests/records/puc19-gfp-product.json), beside your script, or use
a record of your own.

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

- **SVG** for a web page, or to change the drawing in a vector editor such as Inkscape. Each
  letter is an outline, so it looks the same on a computer that lacks molviz's fonts.
- **PNG** for slides and documents that take an image.
- **PDF** for print and for a paper.

The ending is read in any case, so `.PDF` works too. Any other ending raises `ValueError`.

A file has no bar of switches. It shows the record with the [options](../api.md#options) you
passed to `draw`. If those options turn on the sequence view, the PDF has the map on its first
page and the rows of bases on the pages after it.
[Write the rows to a PDF](show-the-bases.md#write-the-rows-to-a-pdf) gives the steps.

## Set the PNG's resolution

`write` draws a PNG at 300 dots per inch (dpi). To change that, pass `dpi`:

```python
drawing.write("puc19-gfp.png", dpi=600)
```

A drawing is measured in points, 72 to the inch, so a PNG prints at the drawing's own size at
any dpi. A higher dpi gives more pixels. If the PNG would be too large, `write` raises
`ValueError`. Write a PDF instead, which stays sharp at any size.

## Write a page instead

To write a page that opens in a browser, end the file's name in `.html`:

```python
drawing.write("puc19-gfp.html")
```

The page opens offline. A record's page draws it with the viewer, so that the reader can turn the
map and switch views. A gel's, a plate's or a figure's page holds its still drawing. To put
several drawings in one page, see [Put drawings in your own page](your-own-page.md).
[Pages, files and still drawings](../explanation/outputs.md) compares a page with each file.
