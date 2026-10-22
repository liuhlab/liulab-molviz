# Coordinates

A record counts its bases from 0, and a span `{start, end}` holds the bases from `start` up to
`end`, but not the base at `end`. A reader never sees these numbers. Every label and every hover
counts from 1 and includes both ends, as SnapGene and GenBank do. molviz writes them that way.
This page explains why the record counts one way and the drawing another, and how a span
crosses the origin of a circular record. The [record format](../reference/record.md#coordinates)
states each rule in full.

## A span counts from 0 and stops before its end

In pUC19-GFP, GFP is the span `{"start": 395, "end": 1112}`. Counted from 0, it holds the bases
at 395 to 1111. A reader sees it as 396 .. 1112.

Counting this way keeps the arithmetic plain:

- A span's length is `end - start`, here 717 bases, with no 1 to add.
- Two spans that touch share a number. The lac promoter in pUC19-GFP is three segments, from
  1173 to 1180, 1180 to 1198 and 1198 to 1204. Each starts where the one before it ends.
- It is how Python slices text, so `bases[395:1112]` gives GFP's bases. Biopython, BED files and
  the lab's cloning tools count the same way, so your code can hand its numbers over as they
  are.

Counting from 1 with both ends included is how people read a map. A person says "base 396",
not "the base at index 395". So the record keeps the form that code gets right, and molviz turns
it into the form people read when it writes a label.

## A point between bases is the count of bases before it

A cut, an insertion, and a disagreement where a read adds bases all lie between two bases, not
on one. Such a point is the number of bases before it. That number is also the position, from
1, of the base it follows. So a cut after base 406 is `406`, and its label reads `(406)` with no
change. On a circular record the origin is `0`, never the record's length.

A single base, such as a base a primer does not pair with, is its index from 0. It is always
below the record's length, even inside a span across the origin.

## A span across the origin ends past the length

A circular record has no real start. Its origin is only where the numbering begins, and a site
or a feature can lie over it. Such a span lets `end` pass the record's length. pUC19-GFP is
3,347 bp, and its BsmBI site is `{"start": 3343, "end": 3349}`: the last four bases and the
first two. A reader sees it as 3344 .. 2.

There were two other ways to write it, and both cost more:

- **An `end` lower than its `start`**, as SnapGene prints it. Then every length, and every test
  of whether a span holds a base, needs a second case for a span across the origin.
- **Two spans, split at the origin.** Then the site is no longer one span. Nothing in the data
  would tell it apart from a feature that really is made of two pieces.

With `end` past the length, `end - start` is still the span's length, here 6. A span runs at
most once around the record.

The `span` option follows the same rule. With `{"start": 3300, "end": 3400}`, the drawing
below is the 100 bases across pUC19-GFP's origin, drawn as a line. The ruler goes from 3340 on
to 10, the thick tick marks the origin, and the title gives the stretch as 3301 .. 53. One
BsmBI cut lies just past the origin, at 3.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 3300, "end": 3400}, "enzymes": ["BsmBI"]}
</script>
</div>

## A joined feature's segments run in order

A feature can be made of several segments. In pUC19-GFP, lacZα has two, from 145 to 395 and
from 1112 to 1130, because GFP was put in between them. A feature lists its segments in order
of their starts. On a circular record, a segment after the origin is counted past the length,
as a span across the origin is.

On a linear record, a feature may run off the end and on again from the start, but only once.
That happens on a PCR product that starts inside a gene, as when a plasmid's backbone is
amplified from a primer inside lacZα. The one segment that starts lower than the segment before
it marks where the feature runs off the end. Splitting such a feature in two would show the
reader two features where SnapGene shows one, and break its translation.
