# Plates

This page draws each test plate in your browser when the page opens. It uses the same viewer the
Python package carries, so what you see here is what a page written by the package shows.

The plates are the files in `tests/plates/` in the repo. Most are the example plates of mbio,
the lab's tools for cloning, and the note under each one says what it shows. Six are made by
hand, at the end.

Each different text a well holds is its contents. Up to ten contents each take a colour of their
own and a line of the legend. Past ten, every used well takes one colour, and the drawing gives
the count where the legend would be. An empty well is light grey.

A stamp moves one pattern of wells from one plate into another. Each stamp gives two plates,
"From" and "Into", and each well it touches holds the stamp's title.

Rest the pointer on a well to see its name and what it holds. If a plate cannot be drawn, its
place on the page says why.

## ap1-part-carrier-plate

From mbio's ap1 project: a 96-well plate with a different part in each of 72 wells.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-part-carrier-plate.json"
</script>
</div>

## ap1-pcr2-plate

The same 72 parts in the same wells, on the plate for the second PCR.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-pcr2-plate.json"
</script>
</div>

## ap1-primer-stock-plate

A 96-well plate with a different primer in each of 74 wells.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-primer-stock-plate.json"
</script>
</div>

## ap1-primer-working-plate-1

The working copy of the primer stock plate: the same 74 primers in the same wells.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-primer-working-plate-1.json"
</script>
</div>

## ap1-picked-1

A 384-well plate in quarters, with three of its four quarters filled. The quarters take turns
along each row and down each column, so the colours mix.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-picked-1.json"
</script>
</div>

## ap1-index-1

A 96-well plate with a different pair of primers in every well.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-index-1.json"
</script>
</div>

## ap1-index-2

The same, with the second reverse primer in every well.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-index-2.json"
</script>
</div>

## ap1-index-3

The same, with the third reverse primer in every well.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-index-3.json"
</script>
</div>

## ap1-lysate-1

A 1,536-well plate with every well empty, so it has no legend.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-lysate-1.json"
</script>
</div>

## ap1-stock-into-primer-working-plate-1-from

One of the project's four stamps, which copies the primer stock plate into the working
plate. This is the plate it takes from.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-stock-into-primer-working-plate-1-from.json"
</script>
</div>

## ap1-stock-into-primer-working-plate-1-into

The same stamp's plate it fills, well for well.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-stock-into-primer-working-plate-1-into.json"
</script>
</div>

## ap1-sample-a-quarter-of-picked-1-into-index-1-from

A stamp that takes the first quarter of picked 1, every other well of every other row.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-sample-a-quarter-of-picked-1-into-index-1-from.json"
</script>
</div>

## ap1-sample-a-quarter-of-picked-1-into-index-1-into

The same stamp fills all 96 wells of index 1.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-sample-a-quarter-of-picked-1-into-index-1-into.json"
</script>
</div>

## ap1-sample-a-quarter-of-picked-1-into-index-2-from

A stamp that takes the second quarter of picked 1, the wells one column to the right of the
first quarter's.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-sample-a-quarter-of-picked-1-into-index-2-from.json"
</script>
</div>

## ap1-sample-a-quarter-of-picked-1-into-index-2-into

The same stamp fills all 96 wells of index 2.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-sample-a-quarter-of-picked-1-into-index-2-into.json"
</script>
</div>

## ap1-sample-a-quarter-of-picked-1-into-index-3-from

A stamp that takes the third quarter of picked 1, the wells one row down from the first
quarter's.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-sample-a-quarter-of-picked-1-into-index-3-from.json"
</script>
</div>

## ap1-sample-a-quarter-of-picked-1-into-index-3-into

The same stamp fills all 96 wells of index 3.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-sample-a-quarter-of-picked-1-into-index-3-into.json"
</script>
</div>

## ap1-readback-picked-1

From mbio's ap1-readback protocol: a 384-well plate with its first quarter full and a third of
its second quarter filled.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-readback-picked-1.json"
</script>
</div>

## ap1-readback-index-2

A 96-well plate a third full, with a different pair of primers in each of 32 wells.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-readback-index-2.json"
</script>
</div>

## ap1-readback-sample-a-quarter-of-picked-1-into-index-2-from

The protocol's one stamp, which takes the 32 filled wells of the second quarter of picked 1.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-readback-sample-a-quarter-of-picked-1-into-index-2-from.json"
</script>
</div>

## ap1-readback-sample-a-quarter-of-picked-1-into-index-2-into

The same stamp fills the first 32 wells of index 2.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ap1-readback-sample-a-quarter-of-picked-1-into-index-2-into.json"
</script>
</div>

## ten-contents

Made by hand. Ten different contents, the most that each take a colour of their own and a line
of the legend.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/ten-contents.json"
</script>
</div>

## eleven-contents

Made by hand. Eleven, so every used well takes one colour and the drawing counts them in place
of the legend.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/eleven-contents.json"
</script>
</div>

## strip

Made by hand. A strip of 8 tubes: one row.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/strip.json"
</script>
</div>

## one-well

Made by hand. One well, the narrowest a drawing gets, under a title that wraps.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/one-well.json"
</script>
</div>

## sparse-1536

Made by hand. A 1,536-well plate, rows A to AF, with a few wells filled.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/sparse-1536.json"
</script>
</div>

## long-legend

Made by hand. Legend entries too long for one line, one of them a word too long for any line.

<div data-molviz="plate">
<script type="application/json" data-plate>
--8<-- "tests/plates/long-legend.json"
</script>
</div>
