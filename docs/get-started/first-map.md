# Draw your first plasmid map

In this tutorial, we type a small plasmid into Python and draw it as a map. We open the map in a
browser, then write the same map as an SVG file and a PDF file.

You need [pixi](https://pixi.sh) and a terminal. Installing molviz is the one step that needs
the internet. After it, everything here runs offline.

## Make a project

First, make a pixi project for your maps, and add Python and molviz to it:

```bash
pixi init my-maps
cd my-maps
pixi add python=3.13
pixi add --pypi liulab-molviz
```

Add Python before molviz, because pixi needs Python to install a package from PyPI. The last
command ends with a line like this one:

```text
✔ Added liulab-molviz >=2026.10.0, <2027
```

Now check that molviz runs:

```bash
pixi run molviz version
```

It prints the version you installed, such as `2026.10.0`.

## Type a record

molviz draws a record: one DNA molecule, written as a Python dict. Make a file named
`first_map.py` in the `my-maps` folder, and type this into it:

```python
import molviz

record = {
    "name": "pDemo",
    "circular": True,
    "bases": "ACGT" * 750,
    "features": [
        {"name": "Plac", "type": "promoter", "strand": 1, "segments": [{"start": 40, "end": 95}]},
        {"name": "GFP", "type": "CDS", "strand": 1, "segments": [{"start": 100, "end": 820}]},
        {"name": "AmpR", "type": "CDS", "strand": -1, "segments": [{"start": 1760, "end": 2621}]},
    ],
}
molviz.check(record)
print(record["name"], "has", len(record["bases"]), "bases")
```

The record has a name, says whether the molecule is circular, and holds its bases. Here the
bases are a stand-in. `"ACGT" * 750` repeats ACGT to make 3,000 bases. Each feature has a name,
a type and a strand, and covers one or more segments of the bases:

- The `type` is a feature type such as `CDS` or `promoter`. The map colours each feature by
  its type.
- The `strand` is `1` for a feature that reads along the top strand, and `-1` for one that
  reads along the bottom strand.
- A segment's `start` and `end` count bases from 0, and the base at `end` is not part of it.
  GFP's segment holds 720 bases, which the map numbers 101 to 820.

Run the file:

```bash
pixi run python first_map.py
```

It prints `pDemo has 3000 bases`. `molviz.check` found nothing wrong with the record. When it
does find a mistake, it raises an error that names the key. A strand of `3` on GFP gives
`features[1].strand: must be 1, -1, 0 or 2`.

## Draw it as a page

Add these two lines to the end of `first_map.py`:

```python
drawing = molviz.draw(record)
drawing.write("pDemo.html")
```

Run the file again:

```bash
pixi run python first_map.py
```

A new file, `pDemo.html`, sits beside `first_map.py`. Open it in your browser. You can
double-click it, or run `open pDemo.html` on a Mac or `xdg-open pDemo.html` on Linux.

You see a ring with "pDemo" and "3000 bp" in its middle, and a scale of base pairs just inside
it. Near the top, a short orange arrow for Plac leads into GFP, a long blue arrow that runs
clockwise. AmpR, also blue, runs the other way on the far side of the ring. GFP and AmpR have
their names written along them. Plac's arrow is too short for its name, so the name sits outside
the ring, on a line to the arrow.

The map shows no cut sites, because the record lists none. molviz draws only what you hand it.
Your own code finds the cut sites, the primers and the rest, and puts them in the record.

Now try the page:

1. Rest the pointer on GFP. A box shows its name, its type, its place, `101 .. 820`, and its
   length, `720 bp`.
2. Scroll over the ring to turn it.
3. Click **Line** in the bar above the map. The viewer draws the plasmid along a straight line. Click
   **Circle** to bring the ring back.
4. Click **Sequence** to show the bases on both strands, with each feature under them. They sit
   beside the map, or under it in a narrow window.

The page carries the viewer that draws it, so it opens with no server and no network.

## Write an SVG and a PDF

Add two more lines to the end of `first_map.py`:

```python
drawing.write("pDemo.svg")
drawing.write("pDemo.pdf")
```

Run the file once more:

```bash
pixi run python first_map.py
```

Two new files sit beside the page: `pDemo.svg` and `pDemo.pdf`. Open each one. Both hold the
same ring as the page, with no bar above it. These files don't turn or zoom. The PDF has one
page, the size of the drawing.

`write` picks the format from the file's ending, so `drawing.write("pDemo.png")` writes a PNG.

## Next steps

You typed a record, drew it as a page and wrote it as two files. From here:

- [Choose a drawing](choose-a-drawing.md) shows the other drawings molviz makes, and the
  question each one answers.
- The [Python API](../api.md) lists every function, and the [options](../api.md#options) that
  `draw` takes.
