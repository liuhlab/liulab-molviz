# Put drawings in your own page

Put molviz's drawings in a page you build, such as a report that holds a map, a gel and a plate.
The page needs no build step and no network. Show each drawing in one of two ways:

- **Live**, with the viewer. The reader can turn and zoom a map, switch its views and read its
  bases. The page carries the viewer's script.
- **Still**, as SVG written into the page. It looks the same as a live drawing, and its hovers
  show, but the reader can't change it. The page needs no script.

For one drawing on a page of its own, `drawing.write("name.html")` is enough. See
[Export SVG, PNG and PDF](export.md).

## Draw live with the viewer

1. Put `viewer_script()` in a `<script>` element, once.
2. After it, call `molviz.draw(element, record, options)` for each record. The drawing is added
   at the end of the element.

This Python writes a page that draws pUC19-GFP live. Save its record,
[puc19-gfp-product.json](https://raw.githubusercontent.com/liuhlab/liulab-molviz/main/tests/records/puc19-gfp-product.json),
beside the script.

```python
import json
from pathlib import Path

import molviz

record = json.loads(Path("puc19-gfp-product.json").read_text())
options = {"map": "line", "highlight": ["GFP"]}


def script_json(value):
    """Return value as JSON that a <script> element holds safely."""
    return json.dumps(value).replace("<", "\\u003c")


page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>pUC19-GFP</title>
</head>
<body>
<div id="map"></div>
<script>{molviz.viewer_script()}</script>
<script>
molviz.draw(document.getElementById("map"), {script_json(record)}, {script_json(options)});
</script>
</body>
</html>
"""
Path("puc19-gfp-page.html").write_text(page)
```

`script_json` writes each `<` as an escape, so that a name holding `</script>` can't end the
script early. The page draws this:

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"map": "line", "highlight": ["GFP"]}
</script>
</div>

Each record has a bar of switches above its map. A print of the page leaves the bar out.

The other inputs have draw calls of their own: `molviz.drawGel(element, gel)`,
`molviz.drawPlate(element, plate)` and `molviz.drawFigure(element, records, options)`.

## Write still drawings with the font rules

1. Put `font_rules()` in a `<style>` element, once.
2. Write each drawing's `still_svg()` into the page as it is.

This writes a page that holds a gel and a plate, `colony_pcr` from
[Draw a gel](draw-a-gel.md) and `picked` from [Draw a plate and a stamp](draw-a-plate.md):

```python
from pathlib import Path

import molviz

drawings = [molviz.draw_gel(colony_pcr), molviz.draw_plate(picked)]
stills = "\n".join(drawing.still_svg() for drawing in drawings)
page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Colony PCR</title>
<style>{molviz.font_rules()}</style>
</head>
<body>
{stills}
</body>
</html>
"""
Path("colony-pcr-page.html").write_text(page)
```

The page shows these:

<div data-molviz="gel" data-still>
<script type="application/json" data-gel>
--8<-- "tests/gels/golden-gate-colony-pcr.json"
</script>
</div>

<div data-molviz="plate" data-still>
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-picked-1.json"
</script>
</div>

The font rules load molviz's fonts from the page itself. Without them, the browser draws the
text in a font of its own, which may not fit the space laid out for it.

If the page also draws live, leave the font rules out. Each draw call adds them, and written
twice they make the page larger for nothing.

## Make a still drawing in the browser

A page that carries the viewer can make still drawings itself. Each input has a still call:
`molviz.stillSvg(record, options)`, `molviz.gelStillSvg(gel)`, `molviz.plateStillSvg(plate)`
and `molviz.figureStillSvg(records, options)`. Each returns an object whose `svg` is the SVG
text. Call `molviz.declareFaces(document)` once, to add the font rules to the page:

```js
const { svg } = molviz.gelStillSvg(gel);
molviz.declareFaces(document);
document.getElementById("gel").insertAdjacentHTML("beforeend", svg);
```

Don't call `molviz.svg`, `molviz.gelSvg`, `molviz.plateSvg` or `molviz.figureSvg` in a page.
They write the SVG for a file, which needs letter outlines that a page doesn't load, so they
throw an error.
