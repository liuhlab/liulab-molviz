# The line map

This page draws each test record as a line map, in your browser, when the page opens. It uses
the same viewer the Python package carries, so what you see here is what a page written by
the package shows.

The records are the files in `tests/records/` in the repo. The note under each one says what
it holds. The map draws a record's features, its primers at each place they bind, its
insertions, and the cut sites of each enzyme that cuts it once. Where labels would crowd, some
are hidden, and a note at the bottom right counts them.

A circular record drawn whole opens on [the circle](circle.md), so this page asks for the line.

If a record cannot be drawn, its place on the page says why.

## puc19-gfp-product

A Golden Gate product. Its lacZα CDS is joined across the GFP insert.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"map": "line"}
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
{"map": "line", "highlight": ["GFP", "GFP forward", "GFP reverse"]}
</script>
</div>

## puc19-backbone-amplicon

A linear PCR product that starts inside lacZα. The lacZα CDS runs past the record's right end
and on from its left end, so the map draws it in two pieces. A grey join runs from each piece
to the end it meets.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-backbone-amplicon.json"
</script>
</div>

## gfp-amplicon

A linear PCR product of GFP. Its GFP CDS ends at a Golden Gate overhang, and both of its
primers have 5' tails.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/gfp-amplicon.json"
</script>
</div>

## ap1-product

A larger product with many features, some on no strand.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/ap1-product.json"
</script>
<script type="application/json" data-options>
{"map": "line"}
</script>
</div>

## colour-test

Joined, white and grey features. The `split` CDS joins three segments, and the `across`
feature runs over the origin.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/colour-test.json"
</script>
<script type="application/json" data-options>
{"map": "line"}
</script>
</div>

## colour-test, from 2600 to 2750

The same record drawn from base 2600 to base 2750. That stretch runs across the origin, as
the `across` feature does.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/colour-test.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 2600, "end": 2750}}
</script>
</div>

## primer-test

A linear record. Its primer `rev-mismatch` has one mismatch.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/primer-test.json"
</script>
</div>

## both-strands-and-insertions

A feature on both strands, and two insertions, one of them at the origin.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/both-strands-and-insertions.json"
</script>
<script type="application/json" data-options>
{"map": "line"}
</script>
</div>

## mismatch-across-origin

A primer with two sites. One runs across the origin, with a mismatch on each side of it.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/mismatch-across-origin.json"
</script>
<script type="application/json" data-options>
{"map": "line"}
</script>
</div>

## linear-ends

A linear record with a feature and an insertion at each end.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/linear-ends.json"
</script>
</div>

## n-and-cut-at-origin

An N inside a CDS, so one codon translates as X, and an EcoRI cut at the origin.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/n-and-cut-at-origin.json"
</script>
<script type="application/json" data-options>
{"map": "line"}
</script>
</div>
