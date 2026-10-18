---
search:
  exclude: true
---

# Spans are 0-based and half-open, and a span across the origin ends past the length

molviz takes mbio's coordinates unchanged, so its first caller hands over what it already holds.
A span `{start, end}` holds bases `start` to `end - 1`, with `start < end`. On a circular record
a span across the origin lets `end` pass the record's length: on 2,686 bp, a 6 bp site over the
origin is `(2683, 2689)`. A joined feature's segments ascend, each one after the origin counted
past the length, and no feature runs more than one turn.

A point between two bases, such as a cut or an insertion, is the number of bases before it. That
is also the 1-based number of the base it follows, so a cut after base 406 is `406`. A single
base, such as a primer's mismatch, is its index, below the length.

Every position a reader sees is 1-based and inclusive, and the viewer writes it: that site reads
`2684 .. 3`.

## Considered options

- **1-based and inclusive, `end < start` across the origin**, as SnapGene and GenBank print it.
  Every length and containment test needs a branch, and mbio would convert at the boundary.
- **Split at the origin into two segments.** A site stops being one span, and a reader of the
  data cannot tell it from a real join.
