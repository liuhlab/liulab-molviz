---
search:
  exclude: true
---

# How small a page can be: the viewer's fixed cost, and a still figure without the viewer

Research note written for [liulab-molviz#42](https://github.com/liuhlab/liulab-molviz/issues/42)
on 2026-10-19. It answers the ticket's four parts with bytes on disk, uncompressed, as a page
holds them. molviz is at `main` aabcfbd; mbio at 10e8785, its committed examples. Every probe ran
on osx-arm64 from a scratch folder outside the repo, under pixi, and is not committed.

Every claim is tagged **[measured]** (built, run or counted, with what ran), **[read]** (from the
named file) or **[inferred]** (worked out from measured parts, or a projection).

## 1. The answer

**Measure text from a table built with the fonts, carry the faces as WOFF2, and move glyph
outlines out of the page into a second file only export loads.** The page viewer then drops from
402,632 B to 134,583 B with the same drawings, and a file still draws every letter as an outline.
For a figure on a protocol page, a still SVG with real text plus the font rules is smaller again,
up to the point where a page's figures together outweigh the viewer.

| Step | Viewer, today's code | Measured how |
| --- | --- | --- |
| Today: opentype.js and two TTF faces in base64 | 402,632 B | `pixi run build-js` [measured] |
| Text measured from a table, faces as WOFF2, no opentype.js | 134,583 B | the viewer rebuilt with a table-reading `text.ts` [measured] |
| The same, kerning stored by class instead of by pair | about 112,800 B | 134,583 less the 21,818 B saved (section 5) [inferred] |

The table gives opentype.js's widths to the last bit: on all 1,728 texts the test inputs lay out,
and on every pair of characters each sans face holds [measured, section 3]. All 18 page drawings
of the test records come out identical from both builds [measured].

The real costs:

- **Two files, not one.** The outlines a file needs take 209 to 262 KB for two faces, near the
  354 KB of opentype.js and the TTF faces (section 3). Kept in the page script, they cancel the gain. The second file has
  a fixed name too, and the same release ships the same bytes, so promise 8 holds [inferred].
- **A build step for the tables**, the way mbio's `scripts/build_fonts.py` already writes
  advances, kerning, outlines and WOFF2 [read]. molviz's `fonts` environment gains
  `brotli-python` [measured: a scratch pixi environment with conda-forge fontTools 4.67.0 and
  brotli-python 1.2.0 wrote every WOFF2 below].
- **Same file bytes only if the outline table is built with opentype.js.** Built from fontTools'
  pen, the contours start at another point and lack opentype.js's closing segment, so every
  `.svg` and `.pdf` would change bytes once (section 3) [measured].
- **A still figure revises the calls**: a call for SVG with real text, and one for the font
  rules, where the calls say "No font call" (section 6) [read: issue 9's resolution].

## 2. What the viewer is made of today

Attributed through the build's source map, and checked by building with opentype.js replaced by a
one-line stub [measured].

| Part | Bytes |
| --- | --- |
| opentype.js 2.0.0 | 236,625 mapped; 237,918 leave the build when it is stubbed, its licence text included |
| `sans.ttf` and `sans-bold.ttf` as base64 data URLs | 60,371 and 55,955, 116,326 together |
| Licence banner | about 11,000 (9,913 without opentype.js's licence) |
| valibot | 9,905 |
| The viewer's own code, `src/viewer/*.ts` | 28,584, of which `line.ts` 8,240 |
| **Total** | **402,632** |

Without opentype.js and the fonts, about 48,400 B remain. The baseline on
[issue 15](https://github.com/liuhlab/liulab-molviz/issues/15) was 396,287 B at 1fabc60; the line's
primers, cut sites and highlight have landed since and add 6,345 B [measured].

## 3. Text without opentype.js on a page

### How the viewer uses opentype.js today

Read from `src/viewer/text.ts` and opentype.js 2.0.0's `dist/opentype.mjs`, then checked on the
committed subsets with fontTools [measured where marked].

- `measure` calls `getAdvanceWidth(inFace(text), size, {script: "latn"})`. `inFace` replaces a
  character the face lacks with U+FFFD first [read].
- **Kerning comes from GPOS.** opentype.js reads the `kern` feature's pair-adjustment lookups for
  the script it is given [read: `getKerningTables`]. Each sans subset has one such lookup holding
  one class-pair subtable, and no old `kern` table; Sans Mono has no kerning [measured].
- **Lookups are not summed.** opentype.js takes the first subtable that covers the left glyph and
  returns its class value, zero included [read: `Position.getKerningValue`]. HarfBuzz sums
  lookups [read: mbio's `scripts/build_fonts.py`, `kerning`]. With one lookup the two agree
  [measured, below].
- **No substitution happens.** opentype.js applies `liga` and `rlig` by default [read], but the
  subsets' GSUB table keeps no feature [measured], since `build_fonts.py` keeps only `kern`.
- **The order of the sums matters.** opentype.js adds `advance × scale`, then
  `kern × scale`, per glyph, in floating point [read: `forEachGlyph`]. Summing font units first
  and scaling once, as mbio does, differs on 1 of the 1,728 texts, by 8.9 × 10⁻¹⁶ [measured]. A
  table must add in opentype.js's order to give the same numbers.
- **A filled glyph has no closepath.** `Glyph.getPath` writes `Z` only for a stroked path [read].
- **A soft hyphen, U+00AD, is the one disagreement with a browser's shaper.** opentype.js gives it
  its advance, 739 units in Sans; HarfBuzz gives it none [measured: uharfbuzz 0.56.3 on every pair
  of characters]. A label with a soft hyphen is measured wider than it draws, and `textLength`
  stretches it. mbio drops characters of category Cf, which includes it [read:
  `src/mbio/plot/fonts.py`, `INVISIBLE`].

### The table, and whether it gives the same widths

The table holds each face's units per em, ascender, descender, each character's advance and each
kerned pair, read with fontTools from the committed subsets, the way mbio's `build_fonts.py`
reads them [measured, read]. Sans has 2,447 kerned pairs, Sans Bold 1,305, Sans Mono none
[measured].

| Check | Result |
| --- | --- |
| 1,728 texts: what the test records, gels and plates lay out, and each record's names and hidden labels at the sizes used; 331 strings, 71 characters, sizes 5.3 to 13.5, both faces | Table equals `measure` with `===` on 1,728 of 1,728 [measured] |
| Every two-character string of each sans face's 416 characters, at size 2048 | Equal on 173,056 of 173,056 per face [measured] |
| HarfBuzz on the same texts | Equal on all 1,728; on pairs, equal except the 831 holding U+00AD [measured] |
| All 9 test records drawn into happy-dom, with default and with all enzymes, by today's viewer and by the table build | 18 of 18 SVG elements identical [measured] |

**Which test proves it.** None today. `tests/viewer/text.test.ts` pins three widths, such as
`measure("AVATo", "sans", 12)` at 34.79296875, which a table must keep [read]. The proof would
be a new Vitest test: lay out every test input, measure each text with the table and with
opentype.js parsing the committed TTF, and expect `toBe`. That is the probe in the first row. It
keeps opentype.js and the TTF faces as test-only files [inferred].

### Outlines for a file: opentype.js where `svg()` runs, or a table

A file draws every letter as an outline (promise 3), so export needs each glyph's contour. The
sequence-view branch already draws a glyph once in `<defs>`, in font units, and places it with
`<use>` [read: `git diff origin/main...origin/t/sequence-view-mono -- src/viewer/svg.ts`].

| Outline source | Two faces | Three faces | Same outline strings as today |
| --- | --- | --- | --- |
| opentype.js and the TTF faces, in a script only export loads | 354,232 B | 395,237 B | Yes, unchanged code |
| Outline table, plain JSON of opentype.js's contours in font units | 261,695 B | 394,354 B | Yes: 1,244 of 1,244 glyphs as the branch writes them, 1,728 of 1,728 labels as `outline()` writes them [measured] |
| The same table with relative coordinates | 209,481 B | 316,971 B | Yes, if the reader adds them back [inferred] |
| Outline table built from fontTools' pen | about the same [inferred] | about the same [inferred] | **No**: 414 of 416 Sans glyphs start elsewhere or lack the closing line [measured] |

Sizes are sums of measured parts. The opentype.js rows count its 237,918 B, the two faces'
116,314 B and Sans Mono's 41,005 B.

**One script or two.** Two. An outline source is at least 209 KB, so a single script stays near
today's size: 134,583 + 261,695 B is about 396 KB [inferred]. Two files, each with a fixed name
and no hash, keep promise 8, since each build writes the same bytes [inferred]. Python's runtime
would evaluate both before `svg()`; `viewer_script()` still returns the page script [read:
`src/molviz/_runtime.py`]. Because the page script and export measure with the same table, a page
and a file measure text identically by construction, and `Drawing.hidden` stays what a page opens
on [inferred].

## 4. The fonts

Cut with `scripts/build_fonts.py`'s options: the `kern` feature only, no hinting, all name
records, `FFTM` and `MATH` dropped. Only the flavour or the character set changes [measured].

| Face and set | TTF | WOFF | WOFF2 | WOFF2 in base64 |
| --- | --- | --- | --- | --- |
| Sans, the viewer's set | 45,256 | 20,624 | 15,280 | 20,376 |
| Sans Bold, the viewer's set | 41,944 | 20,384 | 15,032 | 20,044 |
| Sans Mono, the viewer's set | 30,736 | 18,068 | 13,468 | 17,960 |
| Sans Mono, printable ASCII and U+FFFD | 13,600 | 7,992 | 5,948 | 7,932 |
| Sans, Latin-1 only | 29,840 | 13,328 | 10,080 | 13,440 |

In base64 the two sans faces take 116,272 B as TTF, 54,680 B as WOFF, and 40,420 B as WOFF2
[measured]. The rebuilt TTFs have the committed sizes but not the committed bytes: their GPOS,
GSUB and `head` tables pack differently, though GPOS and GSUB read the same as XML [measured].

**How mbio gets 53,364 B for three faces.** It is base64 of three WOFF2 subsets of 17,248,
16,848 and 5,924 B: 23,000 + 22,464 + 7,900 [measured]. Its `scripts/build_fonts.py` cuts them
with fontTools, `flavor = "woff2"` and brotli, in a `fonts` pixi environment holding `fonttools`
and `brotli-python` [read]. It renames the family, drops GSUB, and keeps name records 0 to 6, 13
and 14. Labels get Latin-1, Greek and Coptic, General Punctuation, the trade mark sign and U+FFFD;
bases get printable ASCII and U+FFFD [read]. molviz could do the same under pixi by adding
`brotli-python` to its `fonts` feature [measured above].

**Does what measures text still read them?** With the table, nothing reads a font at run time:
the browser reads the WOFF2, and the table was read from the TTF at build time. opentype.js 2.0.0
cannot read WOFF2: it throws "WOFF2 require an external decompressor library" [read:
`dist/opentype.mjs`, `parse`]. It reads WOFF through its bundled tiny-inflate [read], so if
opentype.js stays on the page, WOFF is the smallest it can read, saving 61,592 B [measured].

A tighter set saves little and loses letters: Latin-1 alone saves 5,200 B of Sans WOFF2 and drops
Greek, which a label such as `lacZα` uses [measured: α is in the test records' labels].

## 5. The viewer's size for each combination

| Combination | Viewer now | With Sans Mono |
| --- | --- | --- |
| opentype.js, TTF | 402,632 B [measured] | 438,359 B at 76497b0 [measured] |
| opentype.js, WOFF | about 341,000 B [inferred] | about 360,000 B [inferred] |
| Table, WOFF2 | 134,583 B [measured] | about 156,000 B with the viewer's set; about 145,000 B with ASCII only [inferred] |
| Table with class kerning, WOFF2 | about 112,800 B [inferred] | about 134,000 B / 123,000 B [inferred] |

Class kerning stores each face's first and second classes and the value matrix: 11,631 B for Sans
and 6,918 B for Sans Bold, against 26,363 B and 14,004 B as pairs, and it rebuilds the pair table
exactly [measured]. The branch's mono face costs 41,005 B as a TTF data URL, 17,960 B as WOFF2, or
7,932 B as WOFF2 of ASCII alone. Its table is 2,873 B [measured].

**What the build branches add.** Read from the branches as they stand on 2026-10-19 [measured
where marked]; the finished views are projections.

| Branch | Adds now | Projected when done |
| --- | --- | --- |
| `t/sequence-view-mono` at 76497b0 | 42,072 B over its merge base a2e07b7: Sans Mono's 41,005 B and about 1,067 B of code [measured] | The sequence view's layout, about the line's 8,240 B [inferred] |
| `t/circle-columns` at f5ea9bd | 0 B: `columns.ts` is imported by nothing yet; alone it minifies to 2,928 B [measured] | About 10,000 to 15,000 B: the columns plus a ring layout near the line's size [inferred] |
| Controls, issues 34 and 35 | No branch yet | About 12,000 to 20,000 B: mbio's page script minifies from 28,902 to 11,963 B, and its CSS is 5,605 B [measured, then inferred] |

So a viewer with the circle, the sequence view and the controls lands near 481 KB on today's
route, and near 160 to 190 KB with the table and WOFF2 [inferred: sums of the rows above].

## 6. A still figure on a protocol page

**What mbio does.** `mbio.protocol.render` writes each figure's SVG inline with real text, and
writes the three `@font-face` rules once on any page holding a drawing [read: `_fonts`]. Its
pUC19-GFP protocol page is 206,617 B: font rules 53,720 B, three drawing figures 11,529, 11,258
and 18,375 B with captions, and two gels of 3,632 and 2,774 B [measured]. On the ten of its
eleven protocol pages that draw any, a page's figure SVGs total from 8,717 B to 420,939 B
[measured].

**Can molviz hand over the same?** Yes. `svg.ts` already builds the real-text form for `draw`
and writes the outline form as a string; the sequence-view branch adds a string writer for
nested tags [read]. `fontFaceCss()` returns the rules [read]. Serialised from `draw` in
happy-dom [measured]:

| Drawing | Record JSON | Still SVG, real text | File SVG, outlines |
| --- | --- | --- | --- |
| `puc19-gfp-product`, line | 8,996 | 12,254, 37 `<text>` | 198,592 |
| `ap1-product`, line | 15,236 | 15,780 | 168,025 |
| `colour-test`, span 2600 to 2750 | 7,953 | 2,996 | 30,574 |
| `primer-test` | 2,507 | 8,297 | 98,170 |
| `crowded-sites`, line | 8,771 | 19,300 | 237,152 |

The font rules are 116,479 B today, 40,625 B as WOFF2 for two faces, and about 48,700 to
58,700 B with Sans Mono [measured, then inferred]. A still figure is laid out by the same viewer
in mini-racer, so its widths and hidden labels are a file's, and `textLength` holds each text to
its width [read: `svg.ts`].

**Beside a page that carries the viewer**, for the pUC19-GFP protocol page [inferred: its
111,735 B of other content plus measured parts; three still SVGs the size of mbio's; three
records of at most 9,000 B each]:

| The page carries | About |
| --- | --- |
| Three still SVGs and the font rules | 201,000 to 211,000 B, mbio's size |
| Today's viewer and three records | 541,000 B |
| The table viewer and three records | 273,000 B |
| The table viewer with every view, and three records | 325,000 B |

Still figures win while a page's figure SVG totals less than the viewer and its records. Three of
mbio's protocol pages hold more than the table viewer would: 286,857 B, 320,415 B and 420,939 B
[measured], so there the viewer is smaller [inferred].

## 7. Options

| Option | Page | A file needs | Cost in code | Consequence |
| --- | --- | --- | --- | --- |
| A. Today | 402,632 B | Nothing more | None | The fixed cost dominates every page |
| B. opentype.js reading WOFF | about 341,000 B | Nothing more | A flavour in `build_fonts.py` | One script; saves 61,592 B only |
| C. Table and WOFF2 page script; export script with opentype.js and TTF | 134,583 B | 354,232 B, export only | Table builder, a second build entry, the runtime loads both | opentype.js stays for export; two font formats committed |
| **D. Table and WOFF2 page script; outline table file** | **134,583 B** | **261,695 B, or 209,481 B relative** | Table and outline builder, the runtime loads both | **No font parser at run time; opentype.js only in the build and the equality test** |
| E. Table, WOFF2 and outlines in one script | about 396,000 B | Nothing more | As D | Keeps one script; no page gain |
| F. Still SVG with real text, no viewer | 3,000 to 19,300 B a figure, plus 40,625 to 58,700 B of font rules a page | As C or D | A still-SVG call, a font-rules call | A protocol page at mbio's size; no controls on it |

Sizes are for today's code with two faces. The page column of C, D and E is the viewer alone.

**Recommendation: D for the viewer, and F for protocol figures.** D removes two thirds of the
viewer with the same drawings, and its outline table yields today's outline strings when the
build step uses opentype.js. C is the fallback if a Node build step for outlines is unwelcome. F
lets mbio keep its protocol pages at today's size, choosing the viewer only where a page's
figures outweigh it. If Sans Mono draws only bases and translations, ASCII alone saves another
10,000 B.

## 8. What would change in decided calls or ADRs

No ADR covers fonts or the build's files, so a new one would record the choice: text is measured
from a table built with the fonts, and outlines live in a second file. In `CLAUDE.md`:

- **The core**: "on small d3 modules, rbush and opentype.js" loses opentype.js at run time.
- **Toolchain**: "The built viewer is `src/molviz/viewer.js` ... one script" gains the outline
  file beside it, also fixed-name and gitignored.
- **Releases**: "carries the built viewer file" becomes two files.

In the calls (issue 9's resolution), option F replaces "No font call" with a call for the font
rules, and adds a still SVG with real text beside `svg()`, which the figure ticket (issue 40)
would use.

## Open gaps

- **Nothing ran on linux-64**, and no browser drew the WOFF2 pages; happy-dom does not shape text.
- **`digest-drawings` was not run on a table build.** The outline strings match, but the `.svg`,
  `.png` and `.pdf` digests were not compared.
- **Class kerning and relative outlines were sized, not built** into a viewer.
- **The committed subsets do not rebuild byte for byte** here (section 4); why was not traced.
- **Time to load the outline file** into mini-racer on each `svg()` call was not measured.
- **The projections** for the circle, the sequence view and the controls assume layouts near the
  line's size and controls near mbio's.

## Sources

Read or run 2026-10-19.

- molviz at aabcfbd: `src/viewer/text.ts`, `src/viewer/svg.ts`, `src/viewer/draw.ts`,
  `src/molviz/_runtime.py`, `src/molviz/drawing.py`, `scripts/build_fonts.py`,
  `vite.config.ts`, `tests/viewer/text.test.ts`, `tests/records/`, `tests/gels/`,
  `tests/plates/`.
- Branches: `origin/t/sequence-view-mono` at 76497b0, built in its own scratch worktree with its
  merge base a2e07b7; `origin/t/circle-columns` at f5ea9bd.
- opentype.js 2.0.0, `node_modules/opentype.js/dist/opentype.mjs`: `parse`, `forEachGlyph`,
  `Position.getKerningValue`, `Glyph.getPath`.
- mbio at 10e8785: `src/mbio/plot/fonts.py`, `src/mbio/plot/page.py`,
  `src/mbio/protocol/render.py`, `scripts/build_fonts.py`, `pyproject.toml`,
  `src/mbio/data/fonts/`, `docs/examples/*/protocol.html`, `docs/examples/ap1-library/protocol/`,
  `src/mbio/plot/plot.js`.
- Tools, all from conda-forge or the repo's lock: fontTools 4.67.0, brotli-python 1.2.0,
  uharfbuzz 0.56.3, DejaVu 2.37 (`font-ttf-dejavu`), Vite 8.3.4, happy-dom 21, Node 24.
- Issues: [9](https://github.com/liuhlab/liulab-molviz/issues/9),
  [15](https://github.com/liuhlab/liulab-molviz/issues/15),
  [34](https://github.com/liuhlab/liulab-molviz/issues/34),
  [35](https://github.com/liuhlab/liulab-molviz/issues/35),
  [40](https://github.com/liuhlab/liulab-molviz/issues/40).
