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

## Check your work

```bash
pixi run check
```

That runs the linters, the type checker and the tests. It reports every failure at once, so read to
the bottom before you fix anything.

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
