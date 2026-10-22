---
search:
  exclude: true
---

# Figures

This page draws every test figure once, so that you can check a change to a drawing here. The
figures are the files in `tests/figures/` in the repo. Each one names the records it stacks
and the options it draws them with.

Each figure is one of the figures of mbio, the lab's tools for cloning. All but the last come
from its AP-1 project, which builds a gene in three rounds. If a figure cannot be drawn, its
place on the page says why.

## ap1-round-1

The first round: the empty AP-1 vector above the vector with `N_JUN` in place of its stuffer. `N_JUN` is lit, and only the lower record holds it.

<div data-molviz="figure">
<script type="application/json" data-figure>
[
--8<-- "tests/records/ap1-block-vector-1.json"
,
--8<-- "tests/records/ap1-round-1.json"
]
</script>
<script type="application/json" data-options>
{"map": "line", "span": {"start": 280, "end": 1262}, "enzymes": ["BbsI", "BsaI"], "highlight": ["N_JUN"]}
</script>
</div>

## ap1-round-2

The second round: the first round's vector above the vector with `DBD_JUN` added. `DBD_JUN` is lit.

<div data-molviz="figure">
<script type="application/json" data-figure>
[
--8<-- "tests/records/ap1-round-1.json"
,
--8<-- "tests/records/ap1-round-2.json"
]
</script>
<script type="application/json" data-options>
{"map": "line", "span": {"start": 1033, "end": 1454}, "enzymes": ["BbsI", "BsaI"], "highlight": ["DBD_JUN"]}
</script>
</div>

## ap1-round-3

The third round: the second round's vector above the finished vector with `C_JUN` added. `C_JUN` is lit.

<div data-molviz="figure">
<script type="application/json" data-figure>
[
--8<-- "tests/records/ap1-round-2.json"
,
--8<-- "tests/records/ap1-product.json"
]
</script>
<script type="application/json" data-options>
{"map": "line", "span": {"start": 1225, "end": 1506}, "enzymes": ["BbsI", "BsaI"], "highlight": ["C_JUN"]}
</script>
</div>

## ap1-barcode

One record alone, the empty vector from base 280 to 490, with its stuffer lit and the cut sites of each enzyme that cuts it once.

<div data-molviz="figure">
<script type="application/json" data-figure>
[
--8<-- "tests/records/ap1-block-vector-1.json"
]
</script>
<script type="application/json" data-options>
{"map": "line", "span": {"start": 280, "end": 490}, "highlight": ["internal stuffer"]}
</script>
</div>

## ap1-stuffer

The empty vector from base 346 to 424 with its sequence view, and the cut sites of BbsI and BsmBI.

<div data-molviz="figure">
<script type="application/json" data-figure>
[
--8<-- "tests/records/ap1-block-vector-1.json"
]
</script>
<script type="application/json" data-options>
{"map": "line", "span": {"start": 346, "end": 424}, "sequence_view": true, "enzymes": ["BbsI", "BsmBI"]}
</script>
</div>

## ap1-cargo

The finished vector from base 346 to 398 with its sequence view, and the cut sites of BsaI.

<div data-molviz="figure">
<script type="application/json" data-figure>
[
--8<-- "tests/records/ap1-product.json"
]
</script>
<script type="application/json" data-options>
{"map": "line", "span": {"start": 346, "end": 398}, "sequence_view": true, "enzymes": ["BsaI"]}
</script>
</div>

## puc19-gfp-assembly

The pUC19-GFP product drawn whole, so it is a circle, with its two junctions lit. BbsI is named, but it does not cut this record.

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
