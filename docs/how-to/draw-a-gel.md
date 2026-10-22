# Draw a gel

A gel drawing shows the bands you expect beside a ladder, each band where its size runs. Set it
beside a PCR or a digest in a protocol, so that the reader can compare the real gel with it.

This page draws the colony PCR from the build of pUC19-GFP, the pUC19 vector with GFP put in by
Golden Gate assembly. It checks two colonies: a correct clone, which gives two bands, and an
empty vector, which gives one.

## Write down the gel

Write the gel as a dictionary. Give the ladder's name and its band sizes in base pairs. Then
list the lanes in the order they run, each with its name and the sizes of its bands.

```python
colony_pcr = {
    "title": "Colony PCR",
    "ladder": {
        "name": "NEB 100 bp DNA Ladder (N3231)",
        "bands": [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1517],
    },
    "lanes": [
        {"name": "Correct clone", "bands": [160, 838]},
        {"name": "Empty vector", "bands": [177]},
    ],
}
```

The title is optional. The [gel format](../reference/gel.md) lists every key.

## Draw it and write a file

Call `draw_gel`, then write the drawing to a file. The file's ending picks its format.

```python
import molviz

drawing = molviz.draw_gel(colony_pcr)
drawing.write("colony-pcr.svg")
```

The file holds this gel:

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/golden-gate-colony-pcr.json"
</script>
</div>

The ladder runs in the lane marked L, and the sample lanes follow it, numbered in order. The
legend under the gel names each lane and its sizes. Rest the pointer on a band to see its size.

The gel spans the sizes it holds. Its largest band sits at the top and its smallest near the
foot, spaced by the logarithm of their size, as a real gel runs them. If a ladder size's label
would crowd the one above it, molviz leaves the label off but still draws the band.

`draw_gel` takes no options. molviz draws a gel the same in a file and on a page.

## Leave a lane empty

If you expect no band in a lane, such as a water control, give the lane an empty list:

```python
colony_pcr["lanes"].append({"name": "Water", "bands": []})
```

Its line in the legend reads "no band".

## Check a gel before you draw it

`draw_gel` checks the gel first. To check it without drawing it, call `check_gel`. Both raise
`ValueError`, and the message names each problem by its place in the gel. Here a size was typed
as text:

```python
colony_pcr["lanes"][0]["bands"] = [160, "838"]
molviz.check_gel(colony_pcr)
# ValueError: lanes[0].bands[1]: must be a number
```

To write the gel as a PNG or a PDF, see [Export SVG, PNG and PDF](export.md). To show it in a
page with other drawings, see [Put drawings in your own page](your-own-page.md).
