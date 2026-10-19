# The line map

This page draws each test record as a line map, in your browser, when the page opens. It uses
the same viewer the Python package carries, so what you see here is what a page written by
the package shows.

The records are the files in `tests/records/` in the repo. The note under each one says what
it holds. The map draws a record's features, its primers at each place they bind, its
insertions, and the cut sites of each enzyme that cuts it once. Where labels would crowd, some
are hidden, and a note at the bottom right counts them.

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

A larger product with many features, some on no strand.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/ap1-product.json"
</script>
</div>

## ap1-block-vector-1

The vector the AP-1 library is built in, before any part goes in. A short stuffer sits where
the first part will go.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/ap1-block-vector-1.json"
</script>
</div>

## ap1-round-1

The vector after the first round. The part `N_JUN` and its barcode have replaced the stuffer,
and a new stuffer sits where the next part will go.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/ap1-round-1.json"
</script>
</div>

## ap1-round-2

The vector after the second round, with `DBD_JUN` joined after `N_JUN`. The third round makes
`ap1-product`.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/ap1-round-2.json"
</script>
</div>

## colour-test

Joined, white and grey features. The `split` CDS joins three segments, and the `across`
feature runs over the origin.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/colour-test.json"
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
</div>

## mismatch-across-origin

A primer with two sites. One runs across the origin, with a mismatch on each side of it.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/mismatch-across-origin.json"
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
</div>

## crowded-sites

A circle where 40 enzymes cut within 143 bases, with primers, tiny features and an insertion in
that stretch and just past it. Its labels crowd, so some are hidden, and the note at the bottom
right counts them.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/crowded-sites.json"
</script>
</div>

## crowded-sites, with every enzyme and EcoRI lit

The same circle with the cut sites of all 40 enzymes. EcoRI cuts it three times, so with
nothing lit, its site in the crowd is the first label to hide. Here EcoRI is lit, so that site
is the last to hide, and other sites hide in its place.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/crowded-sites.json"
</script>
<script type="application/json" data-options>
{"enzymes": ["AatII", "Acc65I", "AflII", "AgeI", "AscI", "AvrII", "BamHI", "BanII", "BglII", "BsaI", "BsiWI", "BsmBI", "ClaI", "EcoRI", "EcoRV", "Esp3I", "HindIII", "HpaI", "KpnI", "MfeI", "MluI", "NcoI", "NdeI", "NheI", "NotI", "NruI", "NsiI", "PacI", "PmeI", "PstI", "SacI", "SalI", "SmaI", "SnaBI", "SpeI", "SphI", "StuI", "XbaI", "XhoI", "XmaI"], "highlight": ["EcoRI"]}
</script>
</div>
