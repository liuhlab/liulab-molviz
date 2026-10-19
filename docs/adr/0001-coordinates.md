---
search:
  exclude: true
---

# Spans are 0-based and half-open, and a span across the origin ends past the length

molviz takes mbio's coordinates unchanged, so its first caller hands over what it already holds.
A span `{start, end}` holds bases `start` to `end - 1`, with `start < end`. On a circular record
a span across the origin lets `end` pass the record's length: on 2,686 bp, a 6 bp site over the
origin is `(2683, 2689)`. On a circular record a joined feature's segments ascend, each one after
the origin counted past the length, and no feature runs more than one turn. On a linear record
they ascend too, except that a feature may run off the record's end and on from its start, once,
as on an amplicon that starts inside it. The first segment after the end starts lower than
the one before it, every segment after the end ends at or before where the first segment
starts, and nothing is counted past the length.

A point between two bases, such as a cut or an insertion, is the number of bases before it. That
is also the 1-based number of the base it follows, so a cut after base 406 is `406`. A single
base, such as a primer's mismatch, is its index, below the length.

Every position a reader sees is 1-based and inclusive, and the viewer writes it: that site reads
`2684 .. 3`. A name is the caller's own text, even one that holds a position, such as a
disagreement's `696 A>G`.

## Considered options

- **1-based and inclusive, `end < start` across the origin**, as SnapGene and GenBank print it.
  Every length and containment test needs a branch, and mbio would convert at the boundary.
- **Split at the origin into two segments.** A site stops being one span, and a reader of the
  data cannot tell it from a real join.
- **A linear record's segments always ascend, and the caller splits a feature across the end.**
  The reader sees two features where SnapGene and mbio show one, and its translation breaks.
- **A linear record's segments in any order.** Nothing would say which way a join runs, so it could
  not be drawn.
