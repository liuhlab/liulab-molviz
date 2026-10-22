# Choose what a map shows

A map draws all that a record holds: its features, its primers, the cut sites of each enzyme
that cuts it once, and its insertions, reads, disagreements and traces. This guide leaves out
what your reader doesn't need, picks the enzymes, draws a stretch of the record, and lights the
names that matter. Each option sets what the drawing starts with. On a page, the reader can
still change it with the switches above the map.

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

## Choose the enzymes

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
any case. molviz draws only the cuts that your record lists, so an enzyme with no cut in the
record draws nothing.

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

A span runs at most once round the record. The circle draws a record whole, so `map="circle"`
with a shorter span is an error.

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

## Read the labels that are hidden

Where labels would overlap, a drawing hides some of them and counts them in a notice at the
bottom right of the map. Labels hide when you ask for more than fits. AP-1's product,
`ap1-product.json` in the same folder, holds cuts for 14 enzymes. Drawn on the circle with all
of them, some of its cut-site labels hide:

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

`notice` is the sentence that the drawing shows, and it is empty when nothing hides. `hidden`
lists each label left out by its `kind` and its `name`. A cut site, an insertion, or a
disagreement at a point gives its place as `at`, the count of bases before it. Anything else
gives its place as `spans`, a list of `start` and `end` pairs. Both count as the record does.

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
