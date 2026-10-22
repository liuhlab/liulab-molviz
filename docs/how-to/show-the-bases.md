# Show the bases

The sequence view sets a record's bases in rows, the top strand over the bottom strand. It
draws each feature, primer, cut site and insertion at its own bases, and a CDS with a
translation shows its amino acids over its codons. The sequence view hides nothing. This guide
turns the view on, narrows it to the bases you need, sets its rows, and writes the rows to a
PDF.

The examples draw pUC19-GFP, the pUC19 vector with GFP put in by Golden Gate assembly. Its
record is `puc19-gfp-product.json`, in the repo's
[test records](https://github.com/liuhlab/liulab-molviz/tree/main/tests/records). Load it once:

```python
import json
from pathlib import Path

import molviz

record = json.loads(Path("puc19-gfp-product.json").read_text())
```

Each step writes a page, then shows that page here, drawn from the same record and options.
[The options table](../api.md#options) lists every option with its default.

## Turn on the sequence view

To draw the sequence view with the map, set `sequence_view` to `True`:

```python
molviz.draw(record, sequence_view=True).write("bases.html")
```

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true}
</script>
</div>

On a page, the reader can also turn the view on and off with the **Sequence** switch. The view
draws at most 100,000 bases, the value of `molviz.SEQUENCE_VIEW_LIMIT`. For a longer record,
give a span, or `draw` raises `ValueError`.

## Show only the bases you need

A whole plasmid fills many rows. To show fewer, give a `span` too. This span holds the M13 site,
the ATGA junction and the start of GFP, with GFP's first amino acids over its codons:

```python
molviz.draw(record, span={"start": 340, "end": 520}, sequence_view=True).write("gfp-start.html")
```

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 340, "end": 520}, "sequence_view": true}
</script>
</div>

The map draws the same span as a line. On a circular record, a span may run across the origin,
as [Choose what a map shows](what-a-map-shows.md) explains.

## Set how many bases a row holds

A row holds 60 bases unless you set `bases_per_row`.

To change the row length, set `bases_per_row`. These rows hold 20 bases each:

```python
junction = {"start": 380, "end": 440}
drawing = molviz.draw(record, span=junction, sequence_view=True, bases_per_row=20)
drawing.write("rows-of-20.html")
```

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 380, "end": 440}, "sequence_view": true, "bases_per_row": 20}
</script>
</div>

When the span doesn't divide into whole rows, the last row holds fewer bases.

## Leave out the bottom strand

To draw the top strand alone, set `bottom_strand` to `False`:

```python
drawing = molviz.draw(record, span=junction, sequence_view=True, bottom_strand=False)
drawing.write("top-strand.html")
```

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 380, "end": 440}, "sequence_view": true, "bottom_strand": false}
</script>
</div>

On a page, the reader ticks **Both strands** to bring the bottom strand back. The rows keep its
room, so nothing moves.

## Write the rows to a PDF

To print the bases, write the drawing as a PDF:

```python
molviz.draw(record, sequence_view=True).write("pUC19-GFP.pdf")
```

The PDF holds the drawing from the first step. The map is on the first page, and the rows are
on the pages after it. Each of those pages holds as many whole rows as fit a page the shape of
A4. An SVG or a PNG holds the map and the rows as one tall drawing.
