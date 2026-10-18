# Glossary

The words liulab-molviz uses for what it draws and what a caller hands it.

## Glossary

### Record

One DNA molecule as a caller hands it over: its name, whether it is circular or linear, its
bases, and what is drawn on it.
_Avoid_: construct; sequence, for the whole molecule

### Span

A stretch of a record from one base to another. On a circular record it may run across the
origin.
_Avoid_: range, interval

### View

One way of drawing a record: the circle, the line or the sequence view.

### Map

The circle or the line, as against the sequence view.
_Avoid_: plot

### Circle

A circular record drawn whole, as a ring.
_Avoid_: circular map, plasmid map

### Line

A record, or a span of it, drawn along a straight line and numbered as the record numbers it.
_Avoid_: linear map

### Sequence view

A record's bases on both strands, with what is drawn on them at the scale of single bases.
_Avoid_: sequence map

### Kind

What sort of thing is drawn on a record, such as a feature, a primer or a cut site.

### Feature

A named stretch of a record with a type, such as a CDS or a promoter, on one strand or none, in
one segment or several joined.
_Avoid_: annotation

### Primer

An oligo drawn at each site it binds, with its 5' tail and the bases it does not pair with.

### Cut site

A position where one or more enzymes cut a record, numbered by the base after which the top
strand is cut.
_Avoid_: restriction site, enzyme site

### Unique cutter

An enzyme that cuts a record once.

### Insertion

A point between two bases where bases are added, with how many.

### Highlight

The names a drawing lights. Everything else is dimmed to one grey, and nothing moves.

### Hidden-label notice

The count, by kind, of the labels left out because they would overlap. Hovering it lists them.

### Track

Named curves sampled alike along the bases, such as a Sanger trace's four channels.

### Read

One sequencing result, drawn over the bases it trusts.
_Avoid_: sequencing result, trace

### Disagreement

A place where a read differs from the record it was expected to match.
_Avoid_: mismatch, which is a primer's; difference

### Figure

A still drawing of one record, or several stacked, to one span, set beside a protocol step.

### Gel

A simulated agarose gel: a ladder and sample lanes, each band at its size. It holds no record,
and is handed over on its own.

### Ladder

A DNA size marker in a gel's first lane: its name and its band sizes.
_Avoid_: marker

### Lane

One sample on a gel: its name and its bands, which may be none.

### Band

DNA of one size in a lane, drawn where that size runs.

### Plate

A grid of wells in rows and columns, drawn with what each well holds. It holds no record, and
is handed over on its own.

### Well

One place on a plate, named by its row letters and column number, such as `B3`, and the text
of what it holds.
_Avoid_: kind, for what a well holds, which is a record's word

### Page

One HTML file that draws one or more records and opens offline.

### Reader promise

One of the nine things a drawing guarantees its reader, listed in section 5 of
`docs/research/molviz-mbio-drawings.md`.
