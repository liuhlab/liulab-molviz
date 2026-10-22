# Choose what a map shows

A map draws its record's features and primers, the cut sites of each enzyme that cuts it
once, and its insertions, reads and disagreements. A track's curves show only in the sequence
view. This guide leaves out what your reader doesn't need, picks the enzymes, draws a stretch
of the record, and lights the names that matter. Each option sets what the drawing starts
with. On a page, the reader can still change it with the switches above the map.

The examples draw pUC19-GFP, the pUC19 vector with GFP put in by Golden Gate assembly. Save
its record, [`puc19-gfp-product.json`](https://raw.githubusercontent.com/liuhlab/liulab-molviz/main/tests/records/puc19-gfp-product.json), beside your script, and load
it once:

```python
import json
from pathlib import Path

import molviz

record = json.loads(Path("puc19-gfp-product.json").read_text())
```

Each step shows its code, then the drawing it makes, drawn here from the same record and
options. [The options table](../api.md#options) lists every option with its default.

## Leave out a kind

To leave out everything of one kind, name the kind in `kinds_off`. The kinds are `features`,
`primers`, `cuts`, `insertions`, `reads`, `disagreements` and `tracks`. This map leaves out the
primers:

```python
molviz.draw(record, kinds_off=["primers"]).write("no-primers.html")
```

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"kinds_off": ["primers"]}
</script>
</div>

## Leave out feature types

To leave out features by their type, name the types in `types_off`. This map leaves out the M13
sites, which are `primer_bind` features, and the MCS and the two junctions, which are
`misc_feature`:

```python
molviz.draw(record, types_off=["primer_bind", "misc_feature"]).write("fewer-features.html")
```

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"types_off": ["primer_bind", "misc_feature"]}
</script>
</div>

`types_off` starts as `["source"]`, and your list replaces it. If the record has a `source`
feature that you want left out, name `source` in your list too.

## Name the enzymes to draw

A map draws the cut sites of each enzyme that cuts the record once. To draw other enzymes, name
them in `enzymes`. BsaI cuts pUC19-GFP twice, so its sites are left out until you name it:

```python
molviz.draw(record, enzymes=["BsaI"]).write("bsai.html")
```

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"enzymes": ["BsaI"]}
</script>
</div>

Your list replaces the default, so this map draws BsaI's sites and no others. A name matches in
any case. molviz draws only the [cuts](../reference/record.md#cuts) that your record lists, so
an enzyme with no cut in the record draws nothing.

## Draw the record as a line

A circular record drawn whole opens on the circle. To draw it as a line, set `map` to `"line"`:

```python
molviz.draw(record, map="line").write("line.html")
```

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"map": "line"}
</script>
</div>

## Draw a stretch of the record

To draw only some of the bases, give a `span` with a `start` and an `end`. `start` counts from 0,
and the base at `end` is not drawn. A span is drawn as a line, numbered as the record is. This
span holds GFP and the bases on either side of it:

```python
molviz.draw(record, span={"start": 300, "end": 1250}).write("gfp-span.html")
```

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 300, "end": 1250}}
</script>
</div>

On a circular record, `end` may pass the record's length to run across the origin. pUC19-GFP
has 3,347 bases, so this span holds its last 247 bases and then its first 153:

```python
molviz.draw(record, span={"start": 3100, "end": 3500}).write("origin-span.html")
```

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 3100, "end": 3500}}
</script>
</div>

A span runs at most once around the record. The circle draws a record whole, so `map="circle"`
with a shorter span is an error. [Coordinates](../reference/record.md#coordinates) in the record
format gives the rules for counting bases.

## Light the names that matter

To light some items and dim the rest, name them in `highlight`. All else turns one pale grey,
and nothing moves. This map lights GFP and the two primers that copy it:

```python
molviz.draw(record, highlight=["GFP", "GFP forward", "GFP reverse"]).write("gfp-lit.html")
```

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"highlight": ["GFP", "GFP forward", "GFP reverse"]}
</script>
</div>

A name can be a feature, a primer, an insertion, a read, a disagreement, a track or an enzyme.
An enzyme lights every site it cuts. A name matches in any case. If a name matches nothing in
the record, `draw` raises `ValueError` with the message
`options.highlight[0]: names nothing in the record`.

## Find the hidden labels

Where labels would overlap, a drawing hides some of them and counts them in a notice at the
bottom right of the map. Labels hide when you ask for more than fits. pUC19-GFP hides nothing,
even with every enzyme, so this step draws AP-1's product,
[`ap1-product.json`](https://raw.githubusercontent.com/liuhlab/liulab-molviz/main/tests/records/ap1-product.json),
which holds cuts for 14 enzymes. Drawn on the circle with all of them, some of its cut-site
labels hide:

```python
ap1 = json.loads(Path("ap1-product.json").read_text())
every_enzyme = sorted({cut["enzyme"] for cut in ap1["cuts"]})
drawing = molviz.draw(ap1, enzymes=every_enzyme)
print(drawing.notice)
for label in drawing.hidden:
    print(label)
```

It prints:

```text
6 cut sites are hidden
{'kind': 'cuts', 'name': 'BtgZI', 'at': 1864}
{'kind': 'cuts', 'name': 'BtgZI', 'at': 2233}
{'kind': 'cuts', 'name': 'BtgZI', 'at': 2396}
{'kind': 'cuts', 'name': 'BtgZI', 'at': 2577}
{'kind': 'cuts', 'name': 'BspQI - SapI', 'at': 2295}
{'kind': 'cuts', 'name': 'BspQI - SapI', 'at': 2505}
```

The drawing's [`notice`](../api.md#molviz.Drawing) is the sentence that the drawing shows, and
`hidden` lists each hidden label in the shape that
[Hidden labels](../reference/javascript.md#hidden-labels) gives.

On a page, rest the pointer on the notice to list the hidden labels. The page lays the labels
out again each time the reader turns the circle or flips a switch, so the count can change:

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/ap1-product.json"
</script>
<script type="application/json" data-options>
{"enzymes": ["BbsI", "BpiI", "BsaI", "BspQI", "BtgZI", "NcoI", "PmeI", "PstI", "SapI", "SmaI", "SphI", "SrfI", "XbaI", "XmaI"]}
</script>
</div>

To bring a hidden label back, draw less: leave out a kind, name fewer enzymes, or draw a span. A
lit label is the last to hide, so `highlight` keeps the labels that matter in view.
[How a drawing stays readable](../explanation/readable.md) gives the order in which labels hide.
