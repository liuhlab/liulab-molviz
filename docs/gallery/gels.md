---
search:
  exclude: true
---

# Gels

This page draws every test gel once, at its defaults, so that you can check a change to a
drawing here. The gels are the files in `tests/gels/` in the repo. Most are the example gels of
mbio, the lab's tools for cloning, and the last two are made by hand.

If a gel cannot be drawn, its place on the page says why.

## ap1-pcr1-any-batch

The first of two gels from mbio's AP-1 project, with one lane.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/ap1-pcr1-any-batch.json"
</script>
</div>

## ap1-pcr2-any-well

The second gel from the same project, also with one lane.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/ap1-pcr2-any-well.json"
</script>
</div>

## gateway-colony-pcr

A colony PCR from mbio's Gateway example: a correct clone beside an empty vector.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/gateway-colony-pcr.json"
</script>
</div>

## gibson-pcr-products

The PCR products of mbio's Gibson example, on the 1 kb Plus ladder.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/gibson-pcr-products.json"
</script>
</div>

## gibson-colony-pcr

The Gibson example's colony PCR. The correct clone's lane has two bands.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/gibson-colony-pcr.json"
</script>
</div>

## golden-gate-pcr-products

The same PCR products, for the Golden Gate build.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/golden-gate-pcr-products.json"
</script>
</div>

## golden-gate-colony-pcr

The same colony PCR, for the Golden Gate build.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/golden-gate-colony-pcr.json"
</script>
</div>

## restriction-pcr-products

The PCR product of mbio's restriction cloning example, in one lane.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/restriction-pcr-products.json"
</script>
</div>

## restriction-digests

The digests of the restriction example. The pUC19 lane has a 2 bp band, far below the ladder's smallest.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/restriction-digests.json"
</script>
</div>

## restriction-colony-pcr

The restriction example's colony PCR: a correct clone beside an empty vector.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/restriction-colony-pcr.json"
</script>
</div>

## restriction-diagnostic-digest

The restriction example's diagnostic digest. Its pUC19 lane has the 2 bp band too.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/restriction-diagnostic-digest.json"
</script>
</div>

## pcr-test-expected-bands

From mbio's tests. It has the only lane with no band, and the only ladder listed largest first.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/pcr-test-expected-bands.json"
</script>
</div>

## one-size

Made by hand. Every band is one size, so all of them sit in the middle of the gel.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/one-size.json"
</script>
</div>

## long-names

Made by hand. A long title, ladder name and lane name wrap, one word is too long for any line, and one lane has no band.

<div data-molviz="gel">
<script type="application/json" data-gel>
--8<-- "tests/gels/long-names.json"
</script>
</div>
