# How a drawing stays readable

A plasmid map can hold more than fits on it: a dozen features, as many primers, and a cut site
for every enzyme that cuts. molviz never lets two labels overlap, and it never leaves a label
out without saying so. This page gives the rules a drawing keeps, so that you know what to
trust in it and how to tell what it left out.

## No label overlaps another

No label covers another label or the drawing, in the circle, the line or the sequence view.
Where two labels would overlap, molviz hides one. It does not shrink the text, and it does not
let labels pile up. Shrunk text is hard to read, and in a pile a label can sit closest to the
wrong item. Either way, the reader can't tell that anything is wrong. A hidden label is
counted instead, so the reader knows.

## Every hidden label is counted

A drawing that hides labels says so at the bottom right of the map, counted by kind, such as "3 cut sites and
1 primer are hidden". On a page, rest the pointer on that notice to list the hidden labels. In
Python, the drawing that `molviz.draw` returns holds the same sentence in `notice` and the
hidden labels in `hidden`, so your code can report what a file left out. No notice means every
label shows.

Labels hide in a fixed order, the least useful first:

1. The label of a dimmed item hides before the label of a lit one.
2. Cut sites hide first, then primers, reads, features and insertions. Disagreements hide last.
3. Among cut sites, the enzyme that cuts most often hides first.
4. Where all else is equal, the longest label hides first.

The order follows what a reader looks for. A record can carry dozens of cut sites, and an enzyme
that cuts many times says the least about any one place. A unique cutter, the one a cloning plan
looks for, hides last among cut sites. A disagreement between a read and the record is the point of
checking a clone, so it hides last of all.

A name written on its feature's own arrow never hides, since it takes no room beside the map.
The sequence view hides no label at all.

On a page, a hidden label can come back. Zoom in, and the map is laid out larger. Switch off a
kind you don't need, and its room goes to the rest. The notice counts again each time. A file
is laid out once, at its own size, so what it hides stays hidden, and `hidden` lists it.

## A highlight moves nothing

The [`highlight`](../api.md#options) option names what a reader should look at. Everything else
dims to one pale grey, and nothing moves. Each item stays where it would be with no highlight,
so a lit drawing and a plain one line up item for item. A lit label is the last to hide.

Below, pUC19-GFP is drawn twice as a line: first plain, then with GFP and its two primers
lit. Every arrow and label stays in place.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"map": "line"}
</script>
</div>

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"map": "line", "highlight": ["GFP", "GFP forward", "GFP reverse"]}
</script>
</div>

## Colours follow the feature type

A feature takes its colour from its type. Coding sequences are blue, promoters and other
regulatory parts orange, terminators pink and origins yellow. Other groups of types have colours
of their own, and a type in no group is light grey. The
[record format](../reference/record.md#colours-by-type) lists the types in each group. The
colours come from Paul Tol's light scheme. Tol made it so that readers with colour blindness can
tell its colours apart, and so that black text reads on each of them.

Primers are purple and insertions are red. A colour you give a feature, or one of its segments,
is used instead of the colour of its type. A Sanger trace draws its four curves in the colours
that trace viewers use: A green, C blue, G black and T red.

## A drawing keeps a white ground

A drawing is always drawn on white, even on a page with a dark theme. Every colour above was
chosen against white, so the drawing reads the same on any page and prints the same.

## Positions read as the record numbers them

Every label and every hover counts from 1 and includes both ends, as SnapGene and GenBank do. A
line drawn from part of a record keeps the record's numbers, and a stretch across the origin of
a circular record runs from the last base on to 1. [Coordinates](coordinates.md) explains how a
record writes these positions.

## Text you can find, files that look the same anywhere

On a page, every base and every label is real text, so the browser's find, select and copy work
on it. In an SVG, PNG or PDF file, each letter is drawn as an outline instead. The file then
looks the same in every program and needs no font. [Pages, files and still drawings](outputs.md)
says which to choose.
