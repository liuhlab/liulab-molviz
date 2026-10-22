# Record format

A record is one DNA molecule as you hand it to molviz: its name, whether it is circular, its
bases, and what is drawn on it. In Python a record is a `dict`, which
[`molviz.check`](../api.md#molviz.check) checks and [`molviz.draw`](../api.md#molviz.draw)
draws. In a page it is a JSON object, which the global [`molviz.check`](javascript.md#check)
checks and [`molviz.draw`](javascript.md#draw-into-an-element) draws. Both run the same check.

The check reports every problem it finds, each named by its path, such as
`features[0].segments[0].end: must be greater than start`. Python raises `ValueError`, and the
page's check throws a [`FormatError`](javascript.md#formaterror). A key that is not on this page
is an error.

The guides [Choose what a map shows](../how-to/what-a-map-shows.md),
[Show the bases](../how-to/show-the-bases.md),
[Check a clone against its reads](../how-to/check-a-clone.md) and
[Stack records into a figure](../how-to/stack-records.md) draw records in this format.

## Example

This circular record has one feature, one primer and two cuts.

```json
{
  "name": "pDemo",
  "circular": true,
  "bases": "GAATTCATGAGCAAAGGCGAAGAACTGTTTACCGGCTAAGGATCCAAA",
  "features": [
    {
      "name": "ORF",
      "type": "CDS",
      "strand": 1,
      "segments": [{"start": 6, "end": 39}],
      "translation": "MSKGEELFTG*"
    }
  ],
  "primers": [
    {
      "name": "ORF forward",
      "bases": "GCGCATGAGCAAAGGCGAAGAACTG",
      "sites": [{"start": 6, "end": 27, "strand": 1}]
    }
  ],
  "cuts": [
    {"enzyme": "EcoRI", "start": 0, "end": 6, "at": 1, "stagger": 4},
    {"enzyme": "BamHI", "start": 39, "end": 45, "at": 40, "stagger": 4}
  ]
}
```

## Types

The tables on this page and the gel, plate and figure pages use these types.

| Type | In JSON | In Python |
| --- | --- | --- |
| text | a string | `str` |
| integer | a number with no fraction | `int` |
| number | a finite number | `int` or `float` |
| true or false | `true` or `false` | `True` or `False` |
| list | an array | `list` |
| object | an object | `dict` |
| bases | a string of IUPAC nucleotide letters, `ACGTURYSWKMBDHVN`, in either case | `str` |
| colour | a string written `#rrggbb`, its digits in either case | `str` |

## The record

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `name` | text | yes | | The record's name. The map writes it with the record's length, in the circle's centre or under the line. |
| `circular` | true or false | yes | | Whether the record is circular. Only a circular record can be drawn as a circle, and only its spans can run across the origin. |
| `bases` | bases, at least one | yes | | The top strand, 5' to 3'. Its length is the record's length. |
| `features` | list of [features](#features) | no | `[]` | The named stretches of the record, such as a CDS or a promoter. |
| `primers` | list of [primers](#primers) | no | `[]` | The primers, each drawn at every site it binds. |
| `cuts` | list of [cuts](#cuts) | no | `[]` | One item for each enzyme cutting at one place. molviz draws only the cuts listed here. |
| `insertions` | list of [insertions](#insertions) | no | `[]` | Points where bases are added. |
| `reads` | list of [reads](#reads) | no | `[]` | The reads, each drawn over the bases it trusts. No two reads share a name. |
| `disagreements` | list of [disagreements](#disagreements) | no | `[]` | Places where the reads differ from the record. |
| `tracks` | list of [tracks](#tracks) | no | `[]` | Curves sampled along the bases, such as a Sanger trace. |

## Features

Each item of `features` is an object with these keys.

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `name` | text | yes | | The feature's label. |
| `type` | text | yes | | Its type, such as `CDS` or `promoter`. Any text is allowed. The type sets the default colour, and the [`types_off`](../api.md#options) option names types. |
| `strand` | `1`, `-1`, `0` or `2` | yes | | `1` is the top strand and `-1` the bottom strand. `0` is no strand, drawn with no arrowhead. `2` is both strands, drawn with an arrowhead at each end. |
| `segments` | list of [segments](#segments), at least one | yes | | The stretches the feature covers, joined in order. |
| `color` | colour | no | its [type's colour](#colours-by-type) | The fill of each segment that has no colour of its own. |
| `translation` | text of capital letters and `*`, at least one | no | none | The amino acids of a coding feature, one letter for each codon and `*` for a stop. The sequence view draws them over their codons. molviz does not translate. |
| `codon_start` | `1`, `2` or `3` | no | `1` | The base of the segments, counted from 1, that starts the first codon. Allowed only with `translation`. |

A translation fits its segments. Three bases for each letter must fit in the bases the segments
hold, counted from `codon_start`.

### Segments

Each item of `segments` is an object with these keys.

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `start` | integer | yes | | The segment's first base. |
| `end` | integer | yes | | The base after its last base. It is greater than `start`. |
| `color` | colour | no | the feature's colour | This segment's fill. |

The segments of a feature run in ascending order of `start`. The
[segment rules](#a-features-segments) under Coordinates give the exceptions at the origin and at
a linear record's end.

### Colours by type

A feature with no `color` takes its type's colour. A type matches only as written, in its case.

| Colour | Types |
| --- | --- |
| `#77aadd` | `CDS`, `gene`, `mat_peptide`, `sig_peptide`, `transit_peptide`, `propeptide`, `proprotein`, `exon`, `C_region`, `D_segment`, `J_segment`, `N_region`, `S_region`, `V_region`, `V_segment` |
| `#ee8866` | `promoter`, `enhancer`, `RBS`, `-10_signal`, `-35_signal`, `CAAT_signal`, `TATA_signal`, `GC_signal`, `attenuator`, `misc_signal`, `5'UTR`, `regulatory` |
| `#ffaabb` | `terminator`, `polyA_signal`, `polyA_site`, `3'UTR` |
| `#eedd88` | `rep_origin`, `oriT` |
| `#99ddff` | `protein_bind`, `misc_binding` |
| `#44bb99` | `ncRNA`, `misc_RNA`, `mRNA`, `tRNA`, `rRNA`, `tmRNA`, `precursor_RNA`, `prim_transcript` |
| `#bbcc33` | `LTR`, `repeat_region`, `mobile_element`, `misc_recomb`, `stem_loop`, `D-loop` |
| `#aa3377` | `primer_bind` |
| `#dddddd` | any other type |

## Primers

Each item of `primers` is an object with these keys.

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `name` | text | yes | | The primer's label. |
| `bases` | bases, at least one | yes | | The whole primer, 5' to 3'. Its last bases pair with the record at each site. The bases before them are its 5' tail. |
| `sites` | list of [sites](#sites) | yes | | Each place the primer binds. The list may be empty. |

### Sites

Each item of `sites` is an object with these keys. A site covers only the bases that pair, so
it holds at most as many bases as the primer.

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `start` | integer | yes | | The site's first base. |
| `end` | integer | yes | | The base after its last base. It is greater than `start`, and `end - start` is at most the primer's length. |
| `strand` | `1` or `-1` | yes | | The strand whose bases the primer's bases match, read 5' to 3'. `1` is the top strand and `-1` the bottom strand. |
| `mismatches` | list of integers | no | none | The bases inside the site that the primer does not pair with, each a base of the record. |

## Cuts

Each item of `cuts` is one enzyme cutting the record once, at one place. Two enzymes that cut
at one place are two items.

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `enzyme` | text | yes | | The enzyme's name. The `enzymes` and `highlight` [options](../api.md#options) match it in any case. |
| `start` | integer | yes | | The first base the enzyme recognises. |
| `end` | integer | yes | | The base after the last base it recognises. It is greater than `start`. |
| `at` | integer | yes | | The point where the top strand is cut. It may lie outside the recognised bases, as it does for an enzyme that cuts away from its site. |
| `stagger` | integer | yes | | How far the bottom-strand cut lies from `at`. The bottom strand is cut at `at + stagger`. `0` is a blunt cut. A positive stagger leaves a 5' overhang, and a negative one a 3' overhang. |

On a linear record, `at + stagger` is from `0` to the record's length.

## Insertions

Each item of `insertions` is an object with these keys.

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `name` | text | yes | | The insertion's label. |
| `at` | integer | yes | | The point where the bases go in. |
| `length` | integer, 1 or more | yes | | How many bases go in. |
| `color` | colour | no | `#cc3311` | The colour of its mark and its label. |

## Reads

Each item of `reads` is an object with these keys.

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `name` | text | yes | | The read's label. No other read has this name. A disagreement names its reads by it. |
| `start` | integer | yes | | The first base the read trusts. |
| `end` | integer | yes | | The base after the last base it trusts. It is greater than `start`. |
| `strand` | `1` or `-1` | yes | | The strand the read runs along. `1` is the top strand and `-1` the bottom strand. |

## Disagreements

Each item of `disagreements` is an object with these keys. A disagreement lies either over a
span, given by `start` and `end`, or at a point, given by `at`.

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `name` | text | yes | | Its label, as your code writes it, such as `696 A>G`. |
| `start` | integer | with `end`, or else `at` | | The first base the reads differ at. |
| `end` | integer | with `start`, or else `at` | | The base after the last base they differ at. It is greater than `start`. |
| `at` | integer | without `start` and `end` | | The point where the reads hold bases the record lacks. |
| `bases` | bases | yes | | What the reads hold there. Over a span, `""` is a deletion. At a point, it holds at least one base. |
| `reads` | list of text | yes | | The names of the reads that differ, each the `name` of a read in `reads`. |
| `color` | colour | no | `#bbbbbb` | The colour of its bar, its mark and its label. |

pUC19-GFP's verification record holds one read and two disagreements, each a single base:

```json
{
  "reads": [
    {"name": "consensus.fasta", "start": 0, "end": 3347, "strand": 1}
  ],
  "disagreements": [
    {"name": "696 A>G", "start": 695, "end": 696, "bases": "G", "reads": ["consensus.fasta"], "color": "#cc3311"},
    {"name": "2687 C>T", "start": 2686, "end": 2687, "bases": "T", "reads": ["consensus.fasta"], "color": "#bbbbbb"}
  ]
}
```

## Tracks

Each item of `tracks` is a set of named curves sampled alike along the bases, such as the four
channels of a Sanger trace. A sample is one point along the curves, and each curve holds one
number for each sample. The sequence view draws each track under the rows its peaks reach.

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `name` | text | yes | | The track's label. |
| `curves` | object of [curves](#curves) | yes | | One curve for each base letter. |
| `peaks` | list of pairs of integers | yes | | Each pair is `[sample, base]`: a sample's index, from `0`, and the base of the record it lies over. The samples ascend, and each is less than the curves' length. The bases may descend, as they do for a read on the bottom strand. |

### Curves

`curves` is an object with these keys.

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `A` | list of numbers | yes | | The A channel's height at each sample. |
| `C` | list of numbers | yes | | The C channel's, as long as `A`. |
| `G` | list of numbers | yes | | The G channel's, as long as `A`. |
| `T` | list of numbers | yes | | The T channel's, as long as `A`. |

## Coordinates

Every position in a record counts the top strand's bases from `0`. A position is one of three
things: a base, a span or a point between bases.

### A base

A base is its index. The first base is `0`, and the last is the record's length minus 1. A
primer's mismatches and a track's peaks name bases.

### A span

A span is a `start` and an `end`. It holds the bases from `start` to `end - 1`. The base at
`end` is not part of it and is not drawn. `start` is less than `end`, so a span holds at least
one base. On a linear record, `end` is at most the record's length.

A feature's segments, a primer's sites, a cut's recognised bases, a read, a disagreement over
a span and the [`span` option](../api.md#options) are spans.

### A point between bases

A point is the number of bases before it. A cut after the 406th base is at `406`. On a linear
record a point is from `0` to the record's length. On a circular record the origin is `0`,
never the length, so a point is from `0` to the length minus 1.

A cut's `at`, an insertion's `at` and a disagreement's `at` are points.

### Across the origin

On a circular record a span may run across the origin. Its `end` then passes the record's
length, and the bases past the length count on from `0`. A span runs at most one turn, so
`end - start` is at most the length.

pUC19-GFP has 3,347 bases. Its BsmBI site has `start` 3343 and `end` 3349, so it holds bases
3343 to 3346 and then 0 to 1. Its top-strand cut, after the record's third base, is at `3`
and never `3350`.

### A feature's segments

A feature's segments run in ascending order of `start`, with two exceptions.

- On a circular record, a later segment may start past the length, counted on across the
  origin. Every segment ends at most one turn past the first segment's `start`.
- On a linear record, a feature may run off the record's end and on from its start, once. One
  segment then starts lower than the one before it, and the segments after it ascend again.
  Each segment from that one on ends at or before the first segment's `start`. In the pUC19
  backbone amplicon, a linear record of 2,662 bases, lacZα has the segments
  `{"start": 2394, "end": 2644}` and then `{"start": 14, "end": 32}`.

### Positions a reader sees

A drawing writes each position a reader sees counted from 1, with both ends included. The
BsmBI site above reads `3344 .. 2`. A name is your own text, even one that holds a position,
such as the disagreement `696 A>G`.
