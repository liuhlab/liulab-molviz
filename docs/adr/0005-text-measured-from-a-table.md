---
search:
  exclude: true
---

# A page measures text from a table, and a file's outlines live in a second script

Smaller pages are a central reason molviz exists, and most of a page was the viewer's fixed cost:
opentype.js and two TTF faces in base64 made up 354 KB of a 403 KB viewer. So the viewer measures
text from a table of each glyph's advance and the kerning, built from the font subsets, and
carries the faces as WOFF2. It holds no font parser. The letter outlines a file needs live in a
second script with a fixed name, which only export loads. Both tables are built with opentype.js,
so every width and outline is the one it gave: the same drawings, and a file's bytes unchanged.
The measurements are in
[the page-size note](https://github.com/liuhlab/liulab-molviz/blob/research/page-size/docs/research/molviz-page-size.md).

## Considered options

- **Keep opentype.js and the TTF faces for export, in the second script.** A simpler build, but
  two font formats in the repo and a 354 KB export script.
- **opentype.js reading WOFF, in one script.** It saves 62 KB.
- **The tables and the outlines in one script.** It comes to about the size of today's viewer.

## Consequences

- A release ships two scripts. Python's runtime loads both to write a file, and a browser's
  `molviz.svg` works only where the outline script is loaded beside the viewer.
- The build gains a step that writes the tables and the WOFF2 faces, and a test that the table
  gives opentype.js's widths.
- opentype.js is a build dependency, not a run-time one.
