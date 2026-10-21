# liulab-molviz

A viewer that draws DNA sequences and plasmids in the browser, and later molecules and protein
structures in 3D. Its users are [`liulab-mbio`](https://github.com/liuhlab/liulab-mbio) first,
then `liulab-protein`, then the lab's planned database of reagents and sequences. The easy thing
to get wrong: **the viewer draws only what it is given.** The caller finds cut sites, translates
and places features, and ships data; the browser lays it out and draws it.
Distribution name **`liulab-molviz`**, import name **`molviz`**.

## Decided

[The map that created this repo](https://github.com/liuhlab/liulab-mbio/issues/572) holds the
reasons.

- **Views, in order:** a record as circle, line and sequence view; figures; verification;
  gels; plates.
- **The look.** SnapGene Viewer is the reference. The map keeps SnapGene's labels; the
  sequence view and its interactions copy SeqViz.
- **The core** is molviz's own framework-free SVG layout on small d3 modules and rbush, not a
  viewer package. opentype.js runs only in the build and its tests. mbio's Python layout is not
  ported.
- **Reader promises.** All nine in section 5 of
  [the drawings note](docs/research/molviz-mbio-drawings.md)
  hold. A crowded label is hidden and counted.
- **Releases.** A release ships the Python package `liulab-molviz`, which exports SVG, PNG and
  PDF with no browser. A record's page inlines the viewer, a gel's or plate's a still drawing.
  mbio and liulab-protein pin it. The Python side holds no layout or biology; the drawing is
  JavaScript.
- **The roadmap** is a `wayfinder:map` issue here. Its destination: a release mbio can pin that
  draws everything mbio draws today.

## Restraint

Generalizable, lightweight, uncustomized — in that order, and ahead of thorough.

Every gate, lint rule, cap and check is paid by everyone who works here afterwards. They
arrive one at a time, each reasonable alone, and nothing measures the sum. So before adding
one:

- **Does it generalize?** A rule shaped by one situation belongs where that situation is.
  Evidence that it helps there is not evidence about here.
- **What is the total?** Count what someone must already satisfy before writing any code.
- **Would a narrower rule do?** Prefer narrowing to forbidding a legitimate practice.

**A measurement outranks a hypothesis.** When a rule is shown to fire on correct work, that
is evidence; a defect it might also catch is not. Declining a rule, or removing one that
misfires, is as much a contribution as adding one.

## Toolchain

- **pixi** is the only supported toolchain. Never bare pip, uv, conda or npm. `pyproject.toml`
  is the single source of truth for dependencies, environments, and tasks.
- **Python 3.13**, declared by `requires-python` and the pixi pin. Write it anywhere else — a
  ruff target, a pyright version — and `conformance` holds that copy to the floor.
- **hatchling + hatch-vcs**. The version comes from the newest git tag, CalVer
  `vYYYY.M.PATCH`. Never hand-edit a version.
- **The viewer** is TypeScript, built by Vite, tested by Vitest, linted and formatted by
  Biome. pixi installs node, pnpm and Biome. `package.json` lists npm packages and nothing
  else, `pnpm-lock.yaml` locks them, and every command is a pixi task: add a package with
  `pixi run -- pnpm add -D <name>`, format with `pixi run fmt-js`.
- **The built viewer** is two gitignored scripts with fixed names: `src/molviz/viewer.js` sets
  the global `molviz`; `outlines.js` holds a file's outlines. `test` and `build` run
  `build-js` first; `python -m build` fails when either is missing.
- Platforms: `osx-arm64` and `linux-64`.

## Layout

```text
src/molviz/       the Python package; its two .js files are built, never edited
src/viewer/       the viewer, TypeScript
tests/            pytest and Vitest (*.test.ts), mirroring src/
docs/             the published site; docs/adr/ and docs/agents/ are agent-facing
skills/           repo-local agent skills; `python skills/install.py --help`
scripts/check.sh  the gate runner
GLOSSARY.md       the glossary — the words this repo uses
```

## Gates

`pixi run check` must be green before you commit. It is `check-static` plus the two tests:

| Step | Tool |
| --- | --- |
| `lint`, `fmt-check` | ruff |
| `typecheck` | pyright, `standard` mode, plus annotated parameters outside `tests/` |
| `vale`, `markdownlint` | the writing rules |
| `conformance` | the repo still matches the template's rules |
| `lint-js` | Biome, lint and format |
| `typecheck-js` | tsc |
| `test`, `test-js` | pytest, Vitest |

`check.sh` runs every step and reports **all** failures, not just the first — so read to the
bottom before fixing anything. The docs build is not part of `check`; it needs its own pixi
environment and runs as its own CI job.

Work on a branch and merge through a pull request: `pull_request` tests the merge commit,
while a push to `main` tests it only once it has landed.

Five traps in the gate:

- **`--doctest-modules` runs every `Examples` block in `src/` as a test.** An example that
  downloads, shells out or needs a large file wants `# doctest: +SKIP`, and the marker covers
  only the example it sits on.
- **`filterwarnings = ["error"]`.** Each tolerated warning gets a targeted entry in
  `pyproject.toml` with a comment saying why. Never a blanket ignore.
- **pytest reads the built viewer.** `pixi run test` builds it first; a bare `pytest` tests
  whatever build is on disk, or fails when there is none.
- **`src/` is collected**, so every module is imported at test time. Keep a heavy import
  inside the method body that needs it, not at module scope.
- **A substring of `--help` output is not a substring of the help.** Typer prints it through
  rich, which styles the first dash of an option on its own, so `--version` is several spans
  and not one string. Colour is off under `ssh` and on in CI; reproduce CI with
  `FORCE_COLOR=1`, and strip the styling before you assert.

## Writing rules

Three rules, all enforced by `vale`: be concise; agent-facing documents have word caps;
human-facing prose avoids jargon and stays readable. Read `docs/agents/writing.md` before
writing either kind — the caps are lower than you expect, and this file is subject to one.

### Comments and docstrings are short

Nothing checks these, so the rule is on you. A docstring says what a thing does and what it
promises. A comment says why a line is surprising. Neither is a notebook.

**Do not record:**

- **Measurements.** Sizes, row counts, timings, percentages, entry totals. They were true
  once, on one machine, against one release. A number in a comment is wrong by the next
  release and nothing checks it.
- **The environment.** Hostnames, absolute paths, package versions, which host something ran
  on, what a tool printed that day.
- **Implementation detail a reader can see.** Restating the code below in prose, or narrating
  how the current version happens to work inside.
- **History.** What a previous version did, what was tried, which ticket decided it, what the
  alternative was.

Where a fact genuinely has to survive, it has a home that is checked. A comment is the one
place that holds none of them accountable, which is why it is the wrong place:

| The fact | Where it lives |
| --- | --- |
| What the code does | a test pins it |
| A decision and its trade-off | an ADR |
| Vocabulary | `GLOSSARY.md` |
| What is still open | an issue |
| A measurement | nowhere — delete it |

Keep a docstring to its contract — arguments, return, what it raises, one example if the
example earns its keep. Say the surprising thing in one sentence and stop.

## Read next

| When | Read |
| --- | --- |
| Before changing code | `GLOSSARY.md`, then any ADR covering the area |
| Writing anything | `docs/agents/writing.md` |

The issue tracker, triage labels and domain docs are the lab defaults, the page `/lab-setup`
points every agent at. A page of this repo's own under `docs/agents/` overrides only that one
default, so write one only where this repo differs.
