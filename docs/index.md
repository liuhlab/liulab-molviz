# liulab-molviz

Draws DNA sequences and plasmids in the browser, from data a caller hands over; later molecules and protein structures in 3D.

## Install it

The repo uses [pixi](https://pixi.sh) and nothing else. No pip, no conda, no uv. Clone the
repo, then:

```bash
pixi install
```

That reads `pyproject.toml` and builds the environment from the lock file, so you get the
same versions the tests ran on.

## Use it

The viewer draws in the browser. It is a JavaScript file this package carries, and Python
hands it over as text, ready to go inside a `<script>` element of a page:

```python
from molviz import viewer_script

script = viewer_script()
```

The viewer's source is TypeScript, in `src/viewer/`. `pixi run build-js` builds it into the
package. `pixi run check` and `pixi run build` run that step for you.

The [API reference](api.md) has the full list, built from the docstrings in `src/`.

## Check your work

One command runs the linters, the type checker and the tests:

```bash
pixi run check
```

It runs every step, then prints all the failures at once. Read to the bottom before you
fix anything.

The docs site is built by a separate command, because it needs a heavier environment:

```bash
pixi run docs-build
```

## Where things live

| Path | What it holds |
| --- | --- |
| `src/molviz/` | the Python package |
| `src/viewer/` | the viewer, in TypeScript |
| `tests/` | the tests |
| `docs/` | this site |
| `scripts/check.sh` | the gate every commit has to pass |
| `GLOSSARY.md` | the glossary: the words this repo uses |

Some notes are written for coding agents, not for people. Conventions go under
`docs/agents/`, decision records under `docs/adr/`, and research notes under
`docs/research/`. Nothing in those three directories shows up in the menu or the search
box, and a page written there is still reachable by its own URL.
