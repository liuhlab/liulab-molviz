---
search:
  exclude: true
---

# Records

This page draws every test record once, at its defaults, so that you can check a change to a
drawing here. The records are the files in `tests/records/` in the repo. Most come from mbio,
the lab's tools for cloning, and the last four are made by hand.

A circular record opens on the circle, and a linear one on the line. The switches above each
map flip a circular record between the circle and the line, and show the sequence view. If a
record cannot be drawn, its place on the page says why.

## puc19-gfp-product

A Golden Gate product. Its lacZα CDS is joined across the GFP insert.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
</div>

## puc19-gfp-verification

The same product checked against one consensus read. Of its two disagreements, `696 A>G` lies in GFP and is red, and `2687 C>T` lies in AmpR and is grey.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-verification.json"
</script>
</div>

## puc19-backbone-amplicon

A linear PCR product that starts inside lacZα. The lacZα CDS runs off the record's end and on from its start.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-backbone-amplicon.json"
</script>
</div>

## gfp-amplicon

A linear PCR product of GFP. Both of its primers have 5' tails.

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
</div>

## ap1-block-vector-1

The AP-1 vector before any part goes in. A short stuffer sits where the first part will go.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/ap1-block-vector-1.json"
</script>
</div>

## ap1-round-1

The AP-1 vector after the first round, with `N_JUN` and its barcode in place of the stuffer.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/ap1-round-1.json"
</script>
</div>

## ap1-round-2

The AP-1 vector after the second round, with `DBD_JUN` joined after `N_JUN`.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/ap1-round-2.json"
</script>
</div>

## colour-test

Joined, white and grey features. The `split` CDS joins three segments, and the `across` feature runs over the origin.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/colour-test.json"
</script>
</div>

## primer-test

A linear record. Its primer `rev-mismatch` has one mismatch.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/primer-test.json"
</script>
</div>

## trace-3730

The 120 bases around one changed base in a Sanger read, with the read's trace. Its one disagreement is `61 G>C`.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/trace-3730.json"
</script>
</div>

## trace-3730-reversed

The same bases turned to the other strand, so the read runs along the bottom strand and its disagreement is `60 C>G`.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/trace-3730-reversed.json"
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
