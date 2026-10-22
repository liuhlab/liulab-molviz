# Python API

This page lists the `molviz` package's names, each as its docstring describes it. Import each
one from `molviz`, as in `molviz.draw`. A page that draws in the browser calls the viewer
itself, through the names on the [JavaScript API](reference/javascript.md) page.

Each input's keys are on its format's page: [record](reference/record.md),
[gel](reference/gel.md), [plate](reference/plate.md) and [figure](reference/figure.md).
[Export SVG, PNG and PDF](how-to/export.md) uses `Drawing.write`, and
[Put drawings in your own page](how-to/your-own-page.md) uses `still_svg`, `font_rules` and
`viewer_script`.

## molviz

::: molviz.check

::: molviz.draw

::: molviz.Drawing

::: molviz.draw_figure

::: molviz.check_gel

::: molviz.draw_gel

::: molviz.check_plate

::: molviz.draw_plate

::: molviz.SEQUENCE_VIEW_LIMIT

::: molviz.font_rules

::: molviz.viewer.viewer_script

## Options

`draw` takes these options by name, and so does `draw_figure`, for every record it stacks.
Each says what the drawing starts with. An option it does not know is an error, and one left
out takes its default. `span` counts bases as the record format's
[coordinates](reference/record.md#coordinates) do.
[Choose what a map shows](how-to/what-a-map-shows.md) and
[Show the bases](how-to/show-the-bases.md) use each option in turn.

| Option | What it does | Default |
| --- | --- | --- |
| `span` | Draws only the bases from `start` to `end`, as in `{"start": 10, "end": 500}`. `start` counts from 0, and the base at `end` is not drawn. The line is numbered as the record is. On a circular record, `end` may pass the record's length to run across the origin. | the whole record |
| `map` | The map to draw: `"circle"` or `"line"`. The circle draws a circular record whole, so a linear record, or a `span` short of the whole record, must be drawn as `"line"`. | `"circle"` for a circular record drawn whole, else `"line"` |
| `types_off` | The feature types to leave out. A type the record does not have is ignored. | `["source"]` |
| `kinds_off` | The kinds of thing to leave out: any of `"features"`, `"primers"`, `"cuts"`, `"insertions"`, `"reads"`, `"disagreements"` and `"tracks"`. | `[]` |
| `enzymes` | The enzymes whose cut sites are drawn. A name matches in any case. A name that does not cut the record is ignored. | each enzyme that cuts the record once |
| `highlight` | The names to light up: a feature, a primer, an insertion, a read, a disagreement, a track, or an enzyme, which lights every site it cuts. All else turns one pale grey, and nothing moves. Where labels crowd, a lit label is the last to hide. A name in any case matches. A name that matches nothing in the record is an error. | `[]` |
| `sequence_view` | Draws the sequence view: the bases in rows, on both strands, with each thing drawn on them at its bases. On a page it sits beside the map, or under it when the room is narrow. In a file it sits under the map, and a PDF has the map on its first page and the rows on the pages after. It draws at most `SEQUENCE_VIEW_LIMIT` bases, 100,000, so past that `true` is an error. | `false` |
| `bases_per_row` | How many bases a row of the sequence view holds. The last row may hold fewer. Left out, a page fits its rows to the width it has, from 20 to 100 bases in steps of 10. A row too wide for the page keeps its length, and the sequence view is drawn smaller to fit. | fits the width on a page, 60 in a file |
| `bottom_strand` | Whether the sequence view draws the bottom strand under the top one. | `true` |

## The command line

Installing the package adds the `molviz` command. `molviz` with no command, or
`molviz --help`, lists its commands.

::: molviz.cli.version
    options:
      heading: "molviz version"
      separate_signature: false
      show_signature: false
      show_source: false
      show_symbol_type_heading: false
