# The sequence view

This page draws each test record with its sequence view, in your browser, when the page opens.
The map comes first, and the sequence view sits under it. The page uses the same viewer the
Python package carries, so what you see here is what a page written by the package shows.

The sequence view sets the bases in rows of 60. The top strand runs over the bottom strand,
with a rail of ticks between them, one tick for each base. A number stands over every tenth
base, and each row ends with the number of its last base. Under the bases, each feature is a
bar, with the amino acids of a CDS over it. Primers sit above and below the strands, and cut
sites and insertions cross them. Nothing in the sequence view is hidden.

The records are the files in `tests/records/` in the repo. The note under each one says what
it holds. If a record cannot be drawn, its place on the page says why.

## puc19-gfp-product

A Golden Gate product. Its lacZα CDS is joined across the GFP insert, and some of its primers have 5' tails that hang off the template.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true}
</script>
</div>

## puc19-backbone-amplicon

A linear PCR product that starts inside lacZα. The lacZα CDS runs past the last row's end and on from the first row's start. In each of those rows a thin line joins its piece to the record's end, and its amino acids read on from one piece to the other.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-backbone-amplicon.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true}
</script>
</div>

## gfp-amplicon

A linear PCR product of GFP. Its GFP CDS ends at a Golden Gate overhang, and both of its primers have 5' tails that hang off the template.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/gfp-amplicon.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true}
</script>
</div>

## ap1-product

A larger product with many features, some on no strand. Its `rop` and `lacI` start with GTG, so their amino acids start with V.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/ap1-product.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true}
</script>
</div>

## colour-test

Joined, white and grey features. The `split` CDS joins three segments, and the `across` feature runs over the origin.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/colour-test.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true}
</script>
</div>

## primer-test

A linear record. Its primer `rev-mismatch` has one base that does not pair, drawn in red.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/primer-test.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true}
</script>
</div>

## both-strands-and-insertions

A feature on both strands, and two insertions, one of them at the origin.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/both-strands-and-insertions.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true}
</script>
</div>

## mismatch-across-origin

A primer with two sites. One runs across the origin, with a base that does not pair on each side of it. The other is on the bottom strand.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/mismatch-across-origin.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true}
</script>
</div>

## linear-ends

A linear record with a feature and an insertion at each end. One CDS reads from its second base, and one is on the bottom strand.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/linear-ends.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true}
</script>
</div>

## n-and-cut-at-origin

An N inside a CDS, so one codon reads as X, and an EcoRI cut at the origin.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/n-and-cut-at-origin.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true}
</script>
</div>

## crowded-sites

A circle where 40 enzymes cut within 143 bases. The map hides some of their labels; the sequence view draws every cut site it is given.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/crowded-sites.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true}
</script>
</div>

## puc19-gfp-product, with GFP lit

GFP and the two primers that copy it are lit. They keep their colours, and everything else turns pale grey, in the map and in the sequence view alike.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true, "highlight": ["GFP", "GFP forward", "GFP reverse"]}
</script>
</div>

## colour-test, from 2600 to 2750

Only the bases from 2600 to 2750. That stretch runs across the origin, so the numbers run up to 2686 and start again at 1.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/colour-test.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true, "span": {"start": 2600, "end": 2750}}
</script>
</div>

## primer-test, top strand only

The same record with the bottom strand left out, so each row is shorter.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/primer-test.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true, "bottom_strand": false}
</script>
</div>

## both-strands-and-insertions, 20 bases a row

Rows of 20 bases instead of 60.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/both-strands-and-insertions.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true, "bases_per_row": 20}
</script>
</div>

## crowded-sites, with every enzyme

The cut sites of all 40 enzymes. The map hides many of their labels, and the sequence view hides none.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/crowded-sites.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true, "enzymes": ["AatII", "Acc65I", "AflII", "AgeI", "AscI", "AvrII", "BamHI", "BanII", "BglII", "BsaI", "BsiWI", "BsmBI", "ClaI", "EcoRI", "EcoRV", "Esp3I", "HindIII", "HpaI", "KpnI", "MfeI", "MluI", "NcoI", "NdeI", "NheI", "NotI", "NruI", "NsiI", "PacI", "PmeI", "PstI", "SacI", "SalI", "SmaI", "SnaBI", "SpeI", "SphI", "StuI", "XbaI", "XhoI", "XmaI"]}
</script>
</div>

## puc19-backbone-amplicon, its first 48 bases

Only the first 48 bases, with BbsI's cut site, the forward primer, the BbsI site and the TGGC overhang lit. The small piece of lacZα at the start is grey, and its thin line runs to the record's start.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-backbone-amplicon.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true, "span": {"start": 0, "end": 48}, "enzymes": ["BbsI"], "highlight": ["pUC19 backbone forward", "BbsI", "BbsI site", "TGGC overhang"]}
</script>
</div>

## puc19-backbone-amplicon, from 2580 to the end

Only the bases from 2580 to the end. The large piece of lacZα stops at base 2644, and a thin line joins it to the record's end.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-backbone-amplicon.json"
</script>
<script type="application/json" data-options>
{"sequence_view": true, "span": {"start": 2580, "end": 2662}}
</script>
</div>
