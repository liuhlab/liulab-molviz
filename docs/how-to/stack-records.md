# Stack records into a figure

A figure is a still drawing to set beside a step of a protocol. It draws one record, or several
stacked top to bottom, all with the same options. This guide draws the Golden Gate step that
makes pUC19-GFP: its two PCR products over the plasmid they make.

The records are `gfp-amplicon.json`, `puc19-backbone-amplicon.json` and
`puc19-gfp-product.json`, in the repo's
[test records](https://github.com/liuhlab/liulab-molviz/tree/main/tests/records). Load them
once:

```python
import json
from pathlib import Path

import molviz


def load(name):
    return json.loads(Path(f"{name}.json").read_text())


gfp = load("gfp-amplicon")
backbone = load("puc19-backbone-amplicon")
product = load("puc19-gfp-product")
```

Each step shows its code, then the figure that code makes, drawn here from the same records and
options. A figure takes the options that `draw` takes, which
[the options table](../api.md#options) lists. [The figure format](../reference/figure.md) says
what a figure holds.

## Draw one record

`draw_figure` takes a list of records. Given one, it draws that record alone. A circular record
drawn whole is a circle:

```python
molviz.draw_figure([product], highlight=["ATGA junction", "TGGC junction"]).write("product.svg")
```

<div data-molviz="figure">
<script type="application/json" data-figure>
[
--8<-- "tests/records/puc19-gfp-product.json"
]
</script>
<script type="application/json" data-options>
{"highlight": ["ATGA junction", "TGGC junction"]}
</script>
</div>

## Stack several records

To stack records, list them in the order to draw them, top first. `draw_figure` draws each
record as `draw` draws it alone, and sets its name above it. The options apply to every record,
and a name in `highlight` must match something in at least one of them:

```python
molviz.draw_figure(
    [gfp, backbone, product],
    enzymes=["BbsI"],
    highlight=["ATGA overhang", "TGGC overhang", "ATGA junction", "TGGC junction"],
).write("golden-gate.svg")
```

<div data-molviz="figure">
<script type="application/json" data-figure>
[
--8<-- "tests/records/gfp-amplicon.json"
,
--8<-- "tests/records/puc19-backbone-amplicon.json"
,
--8<-- "tests/records/puc19-gfp-product.json"
]
</script>
<script type="application/json" data-options>
{"enzymes": ["BbsI"], "highlight": ["ATGA overhang", "TGGC overhang", "ATGA junction", "TGGC junction"]}
</script>
</div>

BbsI cuts each PCR product near both ends, and its cuts leave the overhangs lit on the two
lines. The overhangs join to make the junctions lit on the circle. The plasmid holds no BbsI
site, so no cut is drawn on it.

## Draw the same stretch of each record

To draw one stretch of every record, give a `span`. Each record keeps its own numbers, and the
lines share one scale, so a base number sits at the same place in each line. Records that share
their numbering line up, such as a vector before and after a part goes in.
AP-1's vector, `ap1-block-vector-1.json`, takes its first part, N_JUN, in place of a short
stuffer to make `ap1-round-1.json`:

```python
vector = load("ap1-block-vector-1")
round_1 = load("ap1-round-1")
molviz.draw_figure(
    [vector, round_1],
    span={"start": 280, "end": 1262},
    enzymes=["BbsI", "BsaI"],
    highlight=["N_JUN"],
).write("round-1.svg")
```

<div data-molviz="figure">
<script type="application/json" data-figure>
[
--8<-- "tests/records/ap1-block-vector-1.json"
,
--8<-- "tests/records/ap1-round-1.json"
]
</script>
<script type="application/json" data-options>
{"span": {"start": 280, "end": 1262}, "enzymes": ["BbsI", "BsaI"], "highlight": ["N_JUN"]}
</script>
</div>

Only the lower record holds N_JUN, so the upper one turns pale all over. Each record's line and
numbers stay dark.

## Add the bases

To draw the bases under each map, set `sequence_view` to `True`. Give a short span, so the rows
stay few:

```python
molviz.draw_figure(
    [product],
    span={"start": 380, "end": 420},
    sequence_view=True,
    highlight=["ATGA junction"],
).write("atga-junction.pdf")
```

<div data-molviz="figure">
<script type="application/json" data-figure>
[
--8<-- "tests/records/puc19-gfp-product.json"
]
</script>
<script type="application/json" data-options>
{"span": {"start": 380, "end": 420}, "sequence_view": true, "highlight": ["ATGA junction"]}
</script>
</div>

A figure's PDF puts the maps on its first page. Each record's rows follow on pages of their own,
the first of them under the record's name.

## Write the figure

A figure writes the same files as a single record: `.svg`, `.png` and `.pdf`. Its `.html` page
holds the still drawing and no viewer, so a reader can't zoom it or flip a switch. To put a
figure in a page of your own, use `still_svg()`, which returns the drawing as SVG text.
