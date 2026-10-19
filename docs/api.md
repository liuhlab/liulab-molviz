# API reference

Built from the docstrings in `src/molviz/`, so this page and the code cannot drift apart.
Write the docstring; this page follows.

## The examples are tests

`pixi run check` runs the `Examples` blocks in `src/molviz/`, so an example that no longer
matches its code fails the tests.

Write one where it makes the object easier to use, and leave it out where it would not.
An example nobody keeps up to date is worse than none.

Keep an example cheap, offline and deterministic. It has to give the same answer on any
machine, with no network. A line that cannot do that needs `# doctest: +SKIP` at the end of
that line.

Two things about that marker are easy to get backwards:

- It covers only the line it sits on. It does not carry to the line below. In a block that
  mixes lines that run with lines that cannot, each line that cannot run needs its own.
- A trailing comment written as plain prose looks just like a marker and is not one. Only
  the `# doctest:` form is read as one.

## molviz

::: molviz.viewer.viewer_script

::: molviz.check

::: molviz.check_gel

::: molviz.check_plate

::: molviz.draw

::: molviz.draw_gel

::: molviz.draw_plate

::: molviz.Drawing

## Options

`draw` takes these options by name. Each says what the drawing starts with. An option it
does not know is an error, and one left out takes its default.

| Option | What it does | Default |
| --- | --- | --- |
| `span` | Draws only the bases from `start` to `end`, as in `{"start": 10, "end": 500}`. `start` counts from 0, and the base at `end` is not drawn. The line is numbered as the record is. On a circular record, `end` may pass the record's length to run across the origin. | the whole record |
| `map` | The map to draw. For now it can only be `"line"`. | `"line"` |
| `types_off` | The feature types to leave out. A type the record does not have is ignored. | `["source"]` |
| `kinds_off` | The kinds of thing to leave out: any of `"features"`, `"primers"`, `"cuts"` and `"insertions"`. | `[]` |
| `enzymes` | The enzymes whose cut sites are drawn. A name matches in any case. A name that does not cut the record is ignored. | each enzyme that cuts the record once |
| `highlight` | The names to light up: a feature, a primer, an insertion, or an enzyme, which lights every site it cuts. All else turns one pale grey, and nothing moves. A name in any case matches. A name that matches nothing in the record is an error. | `[]` |

## The command line

The whole module, because typer makes every verb a plain function with a docstring, and
`molviz.cli:app` — the object `[project.scripts]` registers — is built from them.

::: molviz.cli
