# Draw a plate and a stamp

A plate drawing shows what each well holds. A stamp drawing shows a transfer: the wells it
takes from one plate and the wells it fills on another.

This guide draws plates from AP-1, a project that builds a library of clones on 96-well and
384-well plates.

## Name what each well holds

Write the plate as a Python dict: its rows, its columns, and `wells`, which maps each well's name
to its contents. A well left out is empty. Rows are lettered from A, and past Z they take two
letters, starting with AA and AB. The [plate format](../reference/plate.md) lists every key.

AP-1's plate picked 1 is a 384-well plate filled in quarters. Each quarter takes every second
row and every second column. Quarter 1 holds the odd columns of rows A, C, E to O. Quarter 2
holds the even columns of those rows. Quarter 3 holds the odd columns of rows B, D, F to P.
Quarter 4 is empty.

```python
import molviz

wells = {}
for i, row in enumerate("ABCDEFGHIJKLMNOP"):
    for column in range(1, 25):
        quarter = 1 + (column - 1) % 2 + 2 * (i % 2)
        if quarter < 4:
            wells[f"{row}{column}"] = f"quarter {quarter}"

picked = {"title": "picked 1", "rows": 16, "columns": 24, "wells": wells}
molviz.draw_plate(picked).write("picked-1.svg")
```

The file holds this plate:

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-picked-1.json"
</script>
</div>

Each different contents takes a colour of its own, and the legend under the plate names it.
Empty wells are pale grey. Rest the pointer on a well to see its name and contents.

[`draw_plate`](../api.md#molviz.draw_plate) takes no options. molviz draws a plate the same
in a file and on a page.

## Draw a plate with many contents

molviz gives a colour of its own to each of up to ten different contents on a plate. Past ten,
every filled well takes one colour, and the legend counts the contents in place of naming them.
The plate format's [colours and legend](../reference/plate.md#colours-and-the-legend) give the
order the colours go in.

AP-1's plate index 1 holds a different pair of primers in each of its 96 wells:

```python
pairs = {
    f"{row}{column}": f"forward {12 * i + column}, reverse 1"
    for i, row in enumerate("ABCDEFGH")
    for column in range(1, 13)
}
index = {"title": "index 1", "rows": 8, "columns": 12, "wells": pairs}
molviz.draw_plate(index).write("index-1.svg")
```

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-index-1.json"
</script>
</div>

Rest the pointer on a well to see its contents.

## Draw a stamp as two plates

A stamp moves one pattern of wells from one plate into another. molviz has no stamp input of its
own, so draw a stamp as two plates: the plate it takes from and the plate it fills. Give each
well the stamp touches the stamp's title as its contents. Each plate then shows the stamp's
wells in one colour, and its legend names the stamp.

AP-1 takes quarter 1 of picked 1 into index 1:

```python
stamp = "Sample a quarter of picked 1 into index 1"
taken = [well for well, contents in wells.items() if contents == "quarter 1"]
filled = [f"{row}{column}" for row in "ABCDEFGH" for column in range(1, 13)]

source = {"title": "From picked 1", "rows": 16, "columns": 24, "wells": dict.fromkeys(taken, stamp)}
target = {"title": "Into index 1", "rows": 8, "columns": 12, "wells": dict.fromkeys(filled, stamp)}
molviz.draw_plate(source).write("from-picked-1.svg")
molviz.draw_plate(target).write("into-index-1.svg")
```

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-sample-a-quarter-of-picked-1-into-index-1-from.json"
</script>
</div>

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-sample-a-quarter-of-picked-1-into-index-1-into.json"
</script>
</div>

Start each plate's title with "From" or "Into", so that a reader can tell the two apart.

## Check a plate before you draw it

`draw_plate` checks the plate first. To check it without drawing it, call
[`check_plate`](../api.md#molviz.check_plate). Both raise `ValueError`, and the message names
each problem by its place in the plate. Here a well lies past the plate's last row:

```python
molviz.check_plate({"rows": 8, "columns": 12, "wells": {"I1": "water"}})
# ValueError: wells.I1: not on the plate, which runs A1 to H12
```

To write a plate as a PNG or a PDF, see [Export SVG, PNG and PDF](export.md). To show plates in
a page with other drawings, see [Put drawings in your own page](your-own-page.md).
