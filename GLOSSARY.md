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

A named stretch of a record with a type, such as a CDS or a promoter, on one strand, both or
none, in one segment or several joined.
_Avoid_: annotation

### Chip

One amino acid of a feature's translation, drawn in the sequence view as a coloured arrow-shaped
block over its codon, pointing along the strand, with the amino acid's one-letter code.

### Primer

An oligo drawn at each site it binds, with its 5' tail and the bases it does not pair with.

### Cut

One enzyme cutting a record once, at one place. The cuts at one position make a cut site.

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

### Selection

The bases a reader picks on a page, by clicking an item or dragging across a view, lit in every
view at once. Picking a cut site selects the bases its enzyme recognises; picking an insertion
selects its point. A selection lives only on a page; a file never holds one.
_Avoid_: highlight, which the caller sets

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

### Close-up

A still drawing of a few dozen bases around one disagreement: the line and the sequence view
over that span, with the reads and tracks on it.

### Figure

A still drawing of one record, or several stacked, to one span, set beside a protocol step.
_Avoid_: row, for one of its records, which is the sequence view's word and a plate's

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

One place on a plate, named by its row letters and column number, such as `B3`. What it holds
is its contents, given as text.
_Avoid_: kind, for what a well holds, which is a record's word

### Input

One thing a caller hands over to be drawn: a record, a figure, a gel or a plate.
_Avoid_: document, data

### Page

One HTML file that opens offline and shows one or more inputs: records, figures, gels or plates.
A record's page carries the viewer, which draws it in the browser; the others hold still
drawings.

### Still drawing

A drawing written into a page as SVG with real text and no viewer, so it is never laid out
again: it cannot be zoomed or switched. Figures, gels and plates go into a page this way.

### Font rules

The `@font-face` rules that set molviz's faces, written once in a page for all its still
drawings.

### Outline script

The second script a release ships beside the viewer: each letter's outline, which only writing
a file needs.

### Reader promise

One of the nine things a drawing guarantees its reader, listed in section 5 of
`docs/research/molviz-mbio-drawings.md`.

### Gallery

The docs site's pages that draw every test input once, at its defaults, so a change to a
drawing can be reviewed on the live site. They are published, but left out of the menu and the
search.
_Avoid_: examples, docs
