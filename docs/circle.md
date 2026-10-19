# The circle

This page draws each circular test record as a circle, in your browser, when the page opens.
It uses the same viewer the Python package carries, so what you see here is what a page
written by the package shows.

A circular record drawn whole opens on the circle. Drawn as a stretch, or asked for the line,
it is drawn as a line instead. [The line map](line-map.md) draws these same records as lines.

The records are the circular files in `tests/records/` in the repo. The note under each one
says what it holds. The record's name and length sit in the middle, with a scale of base pairs
just inside the ring. Each feature is an arrow along its strand, or a box where it has no
strand. The circle also draws each primer at each place it binds, each insertion, and the cut
sites of each enzyme that cuts the record once.

A name that fits on its arrow is written along it. Every other label sits in a column beside
the ring, on a line to what it names. Where labels would crowd, some are hidden, and a note at
the bottom right counts them.

If a record cannot be drawn, its place on the page says why.

## puc19-gfp-product

A Golden Gate product. Its lacZα CDS is joined across the GFP insert.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
</div>

## puc19-gfp-product, with GFP lit

The same record with GFP and the two primers that copy it lit. They keep their colours, and
everything else turns pale grey. Nothing moves.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"highlight": ["GFP", "GFP forward", "GFP reverse"]}
</script>
</div>

## ap1-product

A larger product with many features, some on no strand. Its arrows need so many rings that
each grows too thin to hold its name, so every name goes to a column.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/ap1-product.json"
</script>
</div>

## colour-test

Joined, white and grey features. The `split` CDS joins three segments, and the `across`
feature runs over the origin, at the top of the ring.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/colour-test.json"
</script>
</div>

## both-strands-and-insertions

A feature on both strands, and two insertions, one of them at the origin.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/both-strands-and-insertions.json"
</script>
</div>

## mismatch-across-origin

A primer with two sites. One runs across the origin, with a mismatch on each side of it.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/mismatch-across-origin.json"
</script>
</div>

## n-and-cut-at-origin

An N inside a CDS, so one codon translates as X, and an EcoRI cut at the origin.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/n-and-cut-at-origin.json"
</script>
</div>
