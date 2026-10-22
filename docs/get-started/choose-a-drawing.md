# Choose a drawing

molviz makes seven drawings. Three are views of one record: the circle, the line and the
sequence view. The other four are a figure, a close-up, a gel and a plate. Each one answers its
own question, so start from the question your reader asks.

| Your reader asks | Draw | The call |
| --- | --- | --- |
| What does the plasmid hold, and where? | the circle | `molviz.draw(record)` |
| What lies along this stretch? | the line | `molviz.draw(record, span=...)` |
| Which bases, exactly? | the sequence view | `molviz.draw(record, span=..., sequence_view=True)` |
| What does this step of the protocol make? | a figure | `molviz.draw_figure(records)` |
| Does the clone match at this base? | a close-up | `molviz.draw(checked, span=..., sequence_view=True)` |
| Which bands should the gel show? | a gel | `molviz.draw_gel(gel)` |
| What does each well hold? | a plate | `molviz.draw_plate(plate)` |

Each call takes its input as a Python dict, like the record you type in
[Draw your first plasmid map](first-map.md), and `draw_figure` takes a list of records. Each
call returns a drawing, which [`write`](../api.md#molviz.Drawing.write) saves as a page or a
file. In your own web page, the global `molviz` makes the same drawings with `draw`,
`drawFigure`, `drawGel` and `drawPlate`, which the
[JavaScript API](../reference/javascript.md#draw-into-an-element) lists.

The examples below draw pUC19-GFP, the pUC19 vector with GFP put in by Golden Gate assembly. The
plate comes from AP-1, a project that builds a library of clones on 96-well and 384-well plates.
The viewer draws each example in your browser when the page opens.

## The circle: what a plasmid holds

The circle draws a circular record whole, as a ring, so a reader sees the whole plasmid at once.
Each feature is an arrow along its strand. Primers sit where they bind, and the enzymes that
cut the plasmid once mark their cut sites. A circular record drawn whole opens on the circle, so
the call needs no options.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
</div>

```python
drawing = molviz.draw(record)
```

[Choose what a map shows](../how-to/what-a-map-shows.md) leaves out kinds, feature types and
enzymes, and lights the names that matter.

## The line: what lies along a stretch

The line draws a record, or a span of it, along a straight line, numbered as the record numbers
it. It suits a linear molecule, such as a PCR product, and a part of a plasmid, such as an
insert with the primers around it. Here is the GFP insert and what flanks it, bases 341 to 1210.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 340, "end": 1210}}
</script>
</div>

```python
drawing = molviz.draw(record, span={"start": 340, "end": 1210})
```

A span counts bases from 0 and leaves out the base at `end`, so this span holds bases 341 to
1210 as the line numbers them. Any span shorter than the whole record draws as a line. To draw
a whole circular record as a line, pass `map="line"`.
[Draw a stretch of the record](../how-to/what-a-map-shows.md#draw-a-stretch-of-the-record)
gives the steps, a span across the origin included.

## The sequence view: which bases

The sequence view draws the bases of both strands in rows. Features are bars under the bases,
with the amino acids of each CDS over them. Primers sit above and below the strands, and cut
sites cross them. Use it to show where a primer anneals, where an enzyme cuts or how a junction
reads. Draw it over a short span, because a whole plasmid makes many rows. Here is the start of
GFP, where the ATGA junction joins it to the vector.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 380, "end": 440}, "sequence_view": true}
</script>
</div>

```python
drawing = molviz.draw(record, span={"start": 380, "end": 440}, sequence_view=True)
```

On a page, the sequence view sits beside the map or under it. In a PDF, its rows follow the map
on pages of their own. [Show the bases](../how-to/show-the-bases.md) sets the span, the row
length and the strands.

## A figure: what a step makes

A figure is a still drawing of one record, or of several stacked top to bottom. It goes beside
a step of a protocol. A figure draws every record with the same options, so stacked records line
up. Stack a vector before and after a part goes in, for example. This figure shows the Golden
Gate product. It asks for BbsI, the enzyme of the Golden Gate step. BbsI no longer cuts the
product, so the figure marks no BbsI site. It also lights both junctions.

<div data-molviz="figure">
<script type="application/json" data-figure>
[
--8<-- "tests/records/puc19-gfp-product.json"
]
</script>
<script type="application/json" data-options>
{"enzymes": ["BbsI"], "highlight": ["ATGA junction", "TGGC junction"]}
</script>
</div>

```python
drawing = molviz.draw_figure(
    [record], enzymes=["BbsI"], highlight=["ATGA junction", "TGGC junction"]
)
```

[Stack records into a figure](../how-to/stack-records.md) stacks the two PCR products over the
plasmid they make.

## A close-up: whether the clone is right

A close-up is a still drawing of a few dozen bases around one disagreement, a place where a
read differs from the record it should match. It draws the line and the sequence view over that
span, with the reads on it. Here, one consensus read covers all of pUC19-GFP. At base 696,
inside GFP, the record holds A and the read holds G.

A close-up needs no call of its own. Draw the checked record over 30 bases on each side of the
disagreement, with the sequence view in one row. Light the disagreement and the read, and leave
the cut sites off.

<div data-molviz data-still>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-verification.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 665, "end": 726}, "sequence_view": true, "bases_per_row": 61, "kinds_off": ["cuts"], "highlight": ["696 A>G", "consensus.fasta"]}
</script>
</div>

```python
drawing = molviz.draw(
    checked,
    span={"start": 665, "end": 726},
    sequence_view=True,
    bases_per_row=61,
    kinds_off=["cuts"],
    highlight=["696 A>G", "consensus.fasta"],
)
drawing.write("696.svg")
```

Here `checked` is the record with its reads and disagreements. Write a close-up as an SVG, PNG
or PDF file, or take its SVG text from `drawing.still_svg()`. In your own page, the global's
[`stillSvg`](../reference/javascript.md#still-svg) returns the same SVG.
[Check a clone against its reads](../how-to/check-a-clone.md) adds the reads and draws a
close-up of each disagreement.

## A gel: which bands to expect

A gel is a simulated agarose gel, with a ladder, sample lanes and each band at its size. It
holds no record, because your code works out the sizes. Here is the colony PCR that checks
pUC19-GFP, with a correct clone beside the empty vector.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/golden-gate-colony-pcr.json"
</script>
</div>

```python
drawing = molviz.draw_gel(gel)
```

`draw_gel` takes no options. [Draw a gel](../how-to/draw-a-gel.md) writes this gel down
and draws it.

## A plate: what each well holds

A plate is a grid of wells, each with what it holds, given as text. Up to ten different
contents each get a colour and a line of the legend. Past ten, every filled well takes one
colour, and the legend counts the contents. Rest the pointer on a well to see what it holds.
Here is AP-1's first plate of picked colonies, which has 384 wells. Each colour marks one quarter
of the plate, and each quarter goes into a 96-well plate of its own.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-picked-1.json"
</script>
</div>

```python
drawing = molviz.draw_plate(plate)
```

`draw_plate` takes no options. molviz draws a stamp, which moves a pattern of wells from one
plate into another, as two plates: the one it takes from and the one it fills.
[Draw a plate and a stamp](../how-to/draw-a-plate.md) builds this plate and a stamp from it.

## Live or still

The circle, the line and the sequence view are three views of one record. On a page that
`write` makes, the viewer draws the record, and a reader can switch views, zoom and select
bases. A figure, a close-up, a gel and a plate are still drawings. The viewer draws each one
once, and a reader can't zoom it or switch its view, so it fits a report or a protocol. `write`
also saves every drawing as an SVG, PNG or PDF file.

[Export SVG, PNG and PDF](../how-to/export.md) writes the files, and
[Put drawings in your own page](../how-to/your-own-page.md) puts live and still drawings in a
page you build. [Pages, files and still drawings](../explanation/outputs.md) compares them.
