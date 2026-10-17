---
search:
  exclude: true
---

# Which runtime runs the viewer with no browser, and what turns its SVG into PNG and PDF

Research note written for [liulab-molviz#6](https://github.com/liuhlab/liulab-molviz/issues/6) on
2026-10-17. The Python package exports SVG, PNG and PDF with no browser. It must run the built
viewer, the text `molviz.viewer_script()` returns: one IIFE that defines the global `molviz`, tested
in Node's `vm` with an empty context, no DOM and no `require`. The runtime installs from PyPI on
osx-arm64 and linux-64 for Python 3.13, and under pixi. A PNG or PDF draws every letter as an
outline, and the same input writes the same bytes.

Every claim is **measured** (installed and run in a scratch pixi workspace with Python 3.13 on
osx-arm64), **read** (from the linked source) or **inferred**, and says which. Nothing was run on
linux-64: its column comes from PyPI's file names and from pixi solving the lock for linux-64.
Installed size is the sum of the files a distribution's `RECORD` lists, or a conda package's file
list without symlinks. Memory is peak resident set size from `getrusage`; for an in-process
runtime it includes Python's own 13 to 20 MB. Activity counts are PyPI releases and default-branch
commits since 2025-10-17. Speed was not judged.

## 1. The answer

**Run the viewer in `mini-racer`, V8 in a wheel, and convert with `vl-convert-python`, which mbio
already depends on** (measured and read, sections 2 to 5).

- `mini-racer` gives a bare V8 context inside the Python process: the engine Node's `vm` tests use,
  the same globals plus `setTimeout`, and WebAssembly. It returned `greet`'s string and wrote the same
  SVG bytes as Node, Deno and QuickJS on two workloads. Its wheels are `py3-none`, so a new Python
  should need no new wheel (inferred from the tag).
- `vl-convert-python` writes PNG and PDF from the SVG string, each byte-identical across runs, with
  no date in the PDF. Its PNG pixels equal resvg-py's and Typst's. For mbio it adds nothing; for
  liulab-protein it adds 69.5 MB.

Its real cons:

- **Weight.** 63.7 MB for `mini-racer` plus 69.5 MB for `vl-convert-python`: 133.2 MB for a user
  who has neither (measured). QuickJS does the viewer's job in 1.2 MB.
- **One maintainer, slowing.** `mini-racer` has had no release since 2026-02-01; 5 releases and 21
  commits in the year (measured through PyPI and the GitHub API). `vl-convert-python`'s last
  release is 2026-01-21.
- **A process that never exits.** A `MiniRacer()` left open keeps Python alive after the script
  ends; `with MiniRacer() as ctx:` or `ctx.close()` exits cleanly (measured: both runs left open hung, both closed runs exited). The README
  recommends the context manager "for more deterministic cleanup" (read).
- **Memory.** On the large workload the Python process peaked at 322 MB with `mini-racer`, against
  106 MB with QuickJS (measured). Either fits a modest computer.
- **PDF page size.** vl-convert counts one SVG pixel as one point, so a 1200 px wide SVG becomes a
  1200 pt page, 4/3 of its CSS size. `scale=0.75` and `width="900pt"` both left the page at
  1200 × 2016 pt (measured). Typst gives 900 × 1512 pt. To fix it, the viewer would write the SVG
  for PDF at 0.75 of its size (inferred, not tried).
- **PNG file size.** For identical pixels vl-convert's PNG is 2,405,853 B and resvg-py's 517,195 B
  (measured): it compresses less.

If `mini-racer` stops being released, **Deno** is the fallback that keeps V8: published to PyPI by
the Deno authors, 39 releases in the year, 81.0 MB, run as a subprocess (measured, read). If weight
matters more than running the tests' engine, **quickjs-ng** at 1.2 MB, with no WebAssembly.

## 2. Runtimes

The test: evaluate `viewer.js` as built today, then `molviz.greet("x")`. Every row that ran returned
the string `'Hello, x!'`; the Node rows ran it in `vm.createContext(Object.create(null))` (measured).

| Runtime | Wheels, osx-arm64 / linux-64 | Installed | Runs the viewer | WebAssembly | Licence | Latest release; releases, commits in a year |
| --- | --- | --- | --- | --- | --- | --- |
| **mini-racer** 0.14.1, V8 14.4.258.23 | `py3-none` macosx_11_0_arm64 / manylinux_2_27 | 63.7 MB | Yes, in process | Yes | ISC | 2026-02-01; 5, 21; 218 stars |
| **quickjs-ng** 0.17.0.1 (Python wrapper of QuickJS-ng) | `cp310-abi3` macosx_11_0_arm64 / manylinux_2_17 | 1.2 MB | Yes, in process | No | MIT | 2026-10-01; 8, 2; 7 stars; repo created 2026-02-26 |
| dukpy 0.6.0, QuickJS inside | one wheel per CPython 3.9 to 3.14, both platforms, manylinux_2_17 | 12.1 MB | Yes, in process | No | MIT | 2026-07-23; 2, 11; 534 stars |
| **Deno** 2.9.7, V8 15.0.245.2 | `py3-none` macosx_11_0_arm64 / manylinux_2_27 | 81.0 MB | Yes, subprocess | Yes | MIT | 2026-09-17; 39 |
| Node 24.19.0 from `nodejs-wheel-binaries` | `py2.py3-none` macosx_13_0_arm64 / manylinux_2_28 | 197.6 MB | Yes, subprocess | Yes | MIT | 2026-08-19; 20, 21; 28 stars |
| Node 26.10.0 from conda-forge | none: pixi or conda only | 126.4 MB over Python's own packages | Yes, subprocess | Yes | MIT | — |
| pythonmonkey 1.4.1, SpiderMonkey | cp38 to cp315, both | — | **Did not install**: its dependency `pminit` has no wheel, and the wheel it built was rejected | — | MIT | 2026-10-16; 3 |
| quickjs 1.19.4 (the original wrapper) | no cp313 wheel | — | Not tried | — | — | 2023-11-19; 0 |
| STPyV8 13.1.201.22 | cp313: macosx_14_0_arm64 / manylinux_2_31 | — | Not tried | — | Apache-2.0 | 2025-01-09; 0 |

Notes on the rows, each measured unless marked:

- **pixi solved every installed row for linux-64**, picking the wheels named above: the resolver
  accepts them, but none was run there.
- **Node from conda-forge** is 106.9 MB for `nodejs` plus 19.5 MB of ten libraries Python does not
  already pull (libabseil, libcxx, libnghttp2, zstd and smaller). A pip-only user has no Node at
  all, so the Python package could not rely on it. `nodejs-wheel-binaries` calls itself an
  "unoffical Node.js package" (read: PyPI summary); 125 MB of its 197.6 MB is the `node` binary and
  62 MB C headers.
- **Deno writes a cache folder when it runs** (measured: `v8_code_cache_v2`,
  `dep_analysis_cache_v2` and others appeared in an empty `DENO_DIR` after one `deno run -`). A
  library calling it would point `DENO_DIR` somewhere it owns (inferred).
- **dukpy is QuickJS now**: "The name comes from DukPy's original Duktape-based implementation and is
  kept for package compatibility" (read: its PyPI description). It also ships TypeScript, Babel, LESS and React
  scripts: 11 MB of its 12.1 MB (measured).
- **quickjs-ng builds its wheels on each upstream tag**: version `X.Y.Z.P` is the upstream tag plus
  a wrapper patch (read: [its README](https://github.com/genotrance/quickjs-ng)). Upstream
  [QuickJS-ng](https://github.com/quickjs-ng/quickjs) has 3,966 stars and was pushed 2026-10-16
  (measured through the GitHub API). It installs as the import name `quickjs`, the same as the
  original wrapper (measured).

### What a bare context offers

`typeof` of four globals in the context the viewer runs in (measured):

| Context | `WebAssembly` | `TextDecoder` | `atob` | `setTimeout` |
| --- | --- | --- | --- | --- |
| Node `vm`, empty context (the tests) | object | undefined | undefined | undefined |
| mini-racer | object | undefined | undefined | function |
| Deno, global scope of `deno eval` | object | function | function | function |
| quickjs-ng | undefined | undefined | function | undefined |
| dukpy | undefined | undefined | undefined | undefined |

`mini-racer` is the nearest to the tests' context. The viewer can use ECMAScript built-ins and,
outside QuickJS, WebAssembly; anything else it brings itself. The font for opentype.js arrives as
data, decoded by the viewer: the workload below carries its own base64 decoder for that reason.

## 3. The same bytes from every runtime

A workload closer to the real viewer than `greet`: opentype.js 2.0.0's IIFE build, a TrueType font
passed in as base64, and a function that draws a ring, coloured arcs, and every label and base as
glyph outlines through `font.getPath(...).toPathData(2)`. The script is 1,278,565 B (measured).

| Workload | SVG | Runtimes that wrote it | Same bytes | Peak memory |
| --- | --- | --- | --- | --- |
| 60 labels, 3,347 bases | 1,910,006 characters | Node (conda), Node (wheel), Deno, mini-racer, quickjs-ng, dukpy | **Yes**, one SHA-256 for all six | Node child 166 MB, Deno child 149 MB, mini-racer 151 MB, quickjs-ng 59 MB, dukpy 73 MB |
| 200 labels, 20,000 bases | 10,354,879 characters | Node (conda), Deno, mini-racer, quickjs-ng | **Yes**, one SHA-256 for all four | Node 315 MB, Deno 369 MB, mini-racer 322 MB, quickjs-ng 106 MB |

All measured on osx-arm64. **Across platforms it is not measured.** V8 compiles its own sine and
cosine ([`src/base/ieee754.cc`](https://github.com/v8/v8/blob/main/src/base/ieee754.cc): "adapted
from fdlibm", `sin` calling LLVM's libc), while QuickJS-ng calls the C library's
([`quickjs.c`](https://github.com/quickjs-ng/quickjs/blob/master/quickjs.c):
`js_math_sin(double d) { return sin(d); }`) (read). So a V8 runtime should give the same digits on
both platforms, and QuickJS on linux-64 may differ from osx-arm64 in the last digit of a
coordinate, which `toFixed(2)` usually but not always hides (inferred).

## 4. SVG to PNG and PDF

Input: the 1,910,006-character SVG above, 1200 × 2016 px, every letter an outline. PNG at twice
that size. Each converter ran in two separate processes (measured).

| Converter | Formats | Installed | Same bytes, two runs | PDF date | PDF page | PNG | Licence | Latest release; releases, commits in a year |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **vl-convert-python** 1.9.0.post1 | PNG, PDF, JPEG | 69.5 MB | PNG yes, PDF yes | None: only `/Producer (svg2pdf)` | 1200 × 2016 pt | 2,405,853 B | BSD-3-Clause | 2026-01-21; 8, 77 |
| resvg-py 0.5.0 | PNG | 2.2 MB | Yes | — | — | 517,195 B, same pixels as vl-convert | MIT | 2026-08-24; 10, 157 |
| typst 0.15.0, an image in a one-line document | PNG, PDF | 64.9 MB | PNG yes; PDF **only with `#set document(date: none)`** | `/CreationDate`, `/ModDate` and `/ID` change each run unless set | 900 × 1512 pt | Same pixels as resvg-py at 192 ppi | Apache-2.0 | 2026-06-16; 11, 50 |
| resvg-wasm 2.6.2 inside mini-racer and Node's `vm` | PNG | 2,478,606 B `.wasm` plus 8,587 B script | Yes, and the same in both runtimes | — | — | 678,892 B; 24,419 of 9,676,800 pixels differ from resvg-py, by 1 level | MPL-2.0 | 2024-03-26 |
| PDFKit 0.20.2 with svg-to-pdfkit 0.1.8 in Node's `vm` | PDF | — | **Did not load**: needs `TextEncoder`, then `URL` and `require("url")` | — | — | — | MIT | — |
| svg2pdf-py 1.1.0 | PDF | — | Not run: its only linux-64 wheel needs glibc 2.35, and pixi failed to solve it for linux-64 | — | — | — | MIT | 2026-06-02; 1 |

Notes, each measured unless marked:

- **Both PDFs are vector with every letter an outline.** pypdf finds no font, no image and no text
  on the page of the vl-convert PDF or the Typst one.
- **The three Rust converters draw the same pixels.** vl-convert, resvg-py and Typst at 192 ppi
  differ in no pixel, so vl-convert rasterises with resvg (inferred); its PDF names svg2pdf as
  `/Producer` (measured).
- **vl-convert's `scale` does not reach the PDF.** `svg_to_pdf(svg, scale=0.75)` wrote the same bytes
  as without it.
- **WebAssembly needs a shim in a bare V8.** resvg-wasm throws "TextDecoder not available" without
  one (read: its script); a 30-line UTF-8 `TextEncoder` and `TextDecoder` made it run in both
  runtimes. It writes PNG only, and no in-runtime PDF route loaded, so this path still needs a
  Python converter for PDF.
- **Memory.** vl-convert peaked at 94 MB on this SVG and 242 MB on the 10 MB one, PNG and PDF both;
  resvg-py at 102 MB and 294 MB; Typst at 371 MB on the large one, PNG and two PDFs.
- **vl-convert carries its own V8** to run Vega, but its Python API offers no call that runs other
  JavaScript (read: `dir(vl_convert)`), so it cannot run the viewer.

## 5. Why not the others

| Choice | Against it |
| --- | --- |
| quickjs-ng | A wrapper of one person, 7 stars, 2 commits in a year; a different engine from the tests'; no WebAssembly; the C library's `sin` (sections 2, 3) |
| dukpy | Same engine limits as quickjs-ng; a new wheel per CPython; ships transpilers molviz does not need |
| Deno | Subprocess, cache folder per run, 81.0 MB; the best-maintained, so the fallback |
| Node in a wheel | 197.6 MB, unofficial; subprocess |
| Node from conda-forge | Absent for a pip-only user |
| resvg-py | PNG only: a PDF needs a second converter anyway |
| typst | 64.9 MB, a document to compile, and a date to switch off; its PDF page size is the right one |
| resvg-wasm | PNG only, a polyfill, an MPL-2.0 file inside an MIT package, last release 2024-03-26 |

## Open gaps

- **Nothing ran on linux-64.** Wheels and pixi's solve were checked; evaluation, conversion, memory
  and identical bytes between the two platforms were not.
- **The real viewer is a placeholder.** `greet` and the opentype.js workload stand in for the
  layout; a bundle with d3 and rbush was not run.
- **pythonmonkey** was not retried with a source build, and **STPyV8** was not installed.
- **svg2pdf-py** was not run, nor checked for a date in its PDF.
- **No in-runtime PDF route** worked; jsPDF with svg2pdf.js and Typst compiled to WebAssembly were not
  tried.
- **mini-racer on Python 3.14** was not run; the `py3-none` tag says it should load (inferred).

## Sources

All read or retrieved 2026-10-17.

- PyPI JSON for each package, files and metadata: <https://pypi.org/project/mini-racer/>,
  <https://pypi.org/project/quickjs-ng/>, <https://pypi.org/project/dukpy/>,
  <https://pypi.org/project/deno/>, <https://pypi.org/project/nodejs-wheel-binaries/>,
  <https://pypi.org/project/pythonmonkey/>, <https://pypi.org/project/quickjs/>,
  <https://pypi.org/project/stpyv8/>, <https://pypi.org/project/vl-convert-python/>,
  <https://pypi.org/project/resvg-py/>, <https://pypi.org/project/typst/>,
  <https://pypi.org/project/svg2pdf-py/>
- Repositories, through the GitHub API: <https://github.com/bpcreech/PyMiniRacer>,
  <https://github.com/genotrance/quickjs-ng>, <https://github.com/quickjs-ng/quickjs>,
  <https://github.com/amol-/dukpy>, <https://github.com/njzjz/nodejs-wheel>,
  <https://github.com/vega/vl-convert>, <https://github.com/baseplate-admin/resvg-py>,
  <https://github.com/messense/typst-py>, <https://github.com/thx/resvg-js>
- V8 maths: <https://github.com/v8/v8/blob/main/src/base/ieee754.cc>; QuickJS-ng maths:
  <https://github.com/quickjs-ng/quickjs/blob/master/quickjs.c>
- npm builds from jsDelivr: opentype.js 2.0.0 `dist/opentype.min.js`; @resvg/resvg-wasm 2.6.2
  `index.min.js` and `index_bg.wasm`; pdfkit 0.20.2 `js/pdfkit.standalone.js`; svg-to-pdfkit 0.1.8
  `source.js`
