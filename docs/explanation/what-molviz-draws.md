# What molviz draws and what you hand it

molviz draws DNA, but it knows no biology. It holds no list of enzymes, no genetic code and no
aligner. Your code finds where each enzyme cuts, translates each coding sequence, finds where
each primer binds and lines up each read. molviz takes those answers and draws them. It lays
each item out, labels it, colours it and numbers it.

## Your code holds the biology

A record holds the bases and every item drawn on them, each one already worked out:

- A feature gives its type, strand and segments. A coding sequence also gives its
  translation.
- A primer gives its bases and each site where it binds, with any base there that it does not
  pair with.
- A cut gives its enzyme, the bases that enzyme recognises, and where it cuts each strand.
- Reads, the places where a read disagrees with the record, and a Sanger trace's curves come
  from your sequencing analysis.

molviz draws each item where the record puts it. It does not look for more. The
[record format](../reference/record.md) lists every key a record can hold.

## See it on a stretch of pUC19-GFP

The drawing below shows bases 141 to 420 of pUC19-GFP, the pUC19 vector with GFP put in by
Golden Gate assembly. The stretch holds part of lacZα, which runs on the bottom strand, and the
start of GFP, where GFP joins the vector. The drawing asks for two enzymes in the `enzymes`
option, NdeI and PvuII. The record lists a cut for NdeI, so its site is marked. PvuII's site,
`CAGCTG`, is in the bases too, at bases 306 to 311. The record lists no PvuII cut, so nothing
marks it. The amino acids over lacZα and GFP are the translations the record gives.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 140, "end": 420}, "sequence_view": true, "enzymes": ["NdeI", "PvuII"]}
</script>
</div>

## Why the viewer leaves the biology to you

Your tools already have these answers, and your plan depends on them. The enzymes in your
digest, the primers on your order sheet and the reads in your analysis are the ones your code
chose. If molviz found cut sites again, it would need its own list of enzymes. Then a map could
show a site your plan never uses, or miss one it does. When molviz draws only your answers, the
map and the plan agree.

The code that calls molviz also has its own rules, such as which enzymes the lab stocks or how
a read is trimmed. With the biology in your code, those rules stay yours, and molviz stays one
small drawing tool that any code can call.

What is hard to share is the drawing itself: where each label goes, which labels hide when
there is no room, and how a page lets a reader zoom, switch and select. That part molviz
does once, for all the code that calls it.

## What molviz decides for you

molviz still makes some choices, all of them about the drawing:

- It checks the record before it draws. Every position must lie on the record, every span must
  start before it ends, and a translation must fit the bases its feature holds. An unknown key
  is an error, so a misspelt key fails with a message instead of being dropped.
- It counts how often each enzyme cuts, among the cuts you list. An enzyme that cuts once, a
  unique cutter, is set in bold. By default the drawing shows only the unique cutters. The
  `enzymes` option names others.
- It colours each feature by its type, unless you give a colour.
- It draws a primer's 5' tail from the primer's bases that lie past its site.
- It writes every position the way a reader counts, from 1. [Coordinates](coordinates.md)
  explains why the record counts another way.
- It places every label, and hides and counts the ones that would overlap.
  [How a drawing stays readable](readable.md) gives the rules.

The check is about shape, not biology. A translation that fits its bases is drawn as you give
it, even if the codons say otherwise.

## Gels and plates work the same way

A gel takes the size of each band in each lane. molviz does not digest a record or run a PCR to
find them. Your code works out the sizes, and molviz draws where each size runs on the gel. A
plate takes what each well holds, as text. A stamp, which moves wells from one plate into
another, is two plates you build: the one it takes from and the one it fills. The
[gel format](../reference/gel.md) and the [plate format](../reference/plate.md) list what each
holds.

## One check, in Python and in the browser

The format is defined once, in the viewer's JavaScript. Python's `molviz.check` and
`molviz.draw` run that same check, so a record fails the same way in Python and on a page,
with the same message. The message names each problem by its place in the record, such as
`features[0].segments[0].end`.

Options pass through Python in the same way. The [options](../api.md#options) are the viewer's,
and Python adds none of its own.
