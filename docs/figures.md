# Figures

This page draws each test figure in your browser when the page opens. It uses the same viewer
the Python package carries, so what you see here is what a page written by the package shows.

A figure is a still drawing to set beside a step of a protocol. It draws one record, or a few
stacked top to bottom, each as a line over the same stretch of bases. Each record keeps its
own numbers, so a base sits at the same place across the page in every record. When two or
more records stack, each one's name is set above it in grey.

The figures are the files in `tests/figures/` in the repo. Each is one of the figures of mbio,
the lab's tools for cloning, from its AP-1 project. That project builds a gene in three
rounds, adding one part to the vector in each round. Each figure lights one name: what it
names keeps its colour, and all else turns pale grey, so a record that does not hold it turns
pale all over. Each record's line, numbers and title stay dark. Nothing moves.

If a figure cannot be drawn, its place on the page says why.

## ap1-round-1

The first round: the empty vector above, and below it the vector with the N_JUN part in
place of its short stuffer. N_JUN is lit, and only the lower record holds it, so the upper
one is pale.

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

The second round: the first round's vector above, and below it the vector with the DBD_JUN
part added after N_JUN. DBD_JUN is lit, and only the lower record holds it.

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

The third round: the second round's vector above, and below it the finished vector with the
C_JUN part added after DBD_JUN. C_JUN is lit, and only the lower record holds it.

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

One record alone, so no name is set above it: the empty vector from base 280 to 490, with its
stuffer lit. With no enzymes named, it draws the cut sites of each enzyme that cuts the
vector once.

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
