# liulab-molviz

Draws DNA sequences and plasmids in the browser, from data a caller hands over; later molecules and protein structures in 3D.

## Set it up

This repo uses [pixi](https://pixi.sh) and nothing else — no pip, no conda, no uv.
Clone it, then:

```bash
pixi install
```

## Use it

The viewer draws in the browser. It is a JavaScript file this package carries, and Python
hands it over as text, ready to go inside a `<script>` element of a page:

```python
from molviz import viewer_script

script = viewer_script()
```

The viewer's source is TypeScript, in `src/viewer/`. `pixi run build-js` builds it into the
package. `pixi run check` and `pixi run build` run that step for you.

## Use it in another pixi project

The package's name on PyPI is `liulab-molviz`. To draw with it from another pixi project, add
it to the `dependencies` list under `[project]` in that project's `pyproject.toml`:

```toml
[project]
dependencies = [
    # ...the project's other requirements
    "liulab-molviz>=2026.10",
]
```

A project whose settings are in `pixi.toml` adds `liulab-molviz = ">=2026.10"` under
`[pypi-dependencies]` instead. Either way, `pixi install` takes molviz and all it needs from
PyPI, and `pixi.lock` pins the exact release it chose.

Then hand `molviz.draw` a record and write the drawing to a file:

```python
import molviz

record = {
    "name": "pDemo",
    "circular": True,
    "bases": "ACGT" * 500,
    "features": [
        {"name": "GFP", "type": "CDS", "strand": 1, "segments": [{"start": 100, "end": 820}]},
    ],
}
molviz.draw(record).write("pDemo.html")
```

The file's ending picks what is written. An `.html` file is a page that opens offline and
draws the record in the browser. An `.svg`, `.png` or `.pdf` file holds the drawing itself,
made with no browser. The [API reference](https://liuhlab.github.io/liulab-molviz/api/) lists
every option `draw` takes, and the
[test records](https://github.com/liuhlab/liulab-molviz/tree/main/tests/records) show what else
a record can hold.

## Check your work

```bash
pixi run check
```

That runs the linters, the type checker and the tests. It reports every failure at once, so read to
the bottom before you fix anything.

## Where things live

| Path | What it holds |
| --- | --- |
| `src/molviz/` | the Python package |
| `src/viewer/` | the viewer, in TypeScript |
| `tests/` | the tests, and the test records, figures, gels and plates |
| `docs/` | the docs site |
| `scripts/check.sh` | the gate every commit has to pass |
| `GLOSSARY.md` | the glossary: the words this repo uses |

Some notes are for coding agents, not for people: conventions under `docs/agents/`,
decision records under `docs/adr/`, and research notes under `docs/research/`. The site
publishes them, but leaves them out of its menu and its search box.

## Read the docs

The site is at <https://liuhlab.github.io/liulab-molviz/>.
Build it yourself with `pixi run docs-build`.

## Set up your agent

Skills for coding agents live in `skills/`. Link them into each agent's own folder:

```bash
python skills/install.py --target all
```

If you work on the lab's clusters, add the shared plugin once per machine:

```text
/plugin marketplace add liuhlab/liulab-compute-skills
/plugin install lab-compute@liulab
```
