# Figure format

A figure is one record, or several stacked top to bottom, all drawn with one set of options. In
Python a figure is a `list` of records, which [`molviz.draw_figure`](../api.md#molviz.draw_figure)
draws. In a page it is a JSON array of records, which the global
[`molviz.checkFigure`](javascript.md#check) checks and
[`molviz.drawFigure`](javascript.md#draw-into-an-element) draws. Both run the same check.

The check reports every problem it finds, each named by its path from `records`, such as
`records[1].bases: must hold at least one base`. Python raises `ValueError`, and the page's
check throws a [`FormatError`](javascript.md#formaterror).

[Stack records into a figure](../how-to/stack-records.md) draws figures in this format.

## Example

This figure stacks two linear records, each with one feature, and lights the feature named
`insert`.

```json
[
  {
    "name": "vector",
    "circular": false,
    "bases": "GAATTCAAAAAAAAAAGGATCC",
    "features": [
      {"name": "stuffer", "type": "misc_feature", "strand": 0, "segments": [{"start": 6, "end": 16}]}
    ]
  },
  {
    "name": "vector with insert",
    "circular": false,
    "bases": "GAATTCATGAGCAAAGGCGAAGAACTGTAAGGATCC",
    "features": [
      {"name": "insert", "type": "CDS", "strand": 1, "segments": [{"start": 6, "end": 30}]}
    ]
  }
]
```

Its options are `{"highlight": ["insert"]}`.

## The figure

| Part | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| the list | list of records, at least one | yes | | Each item is a record in the [record format](record.md). The first is drawn at the top. |

When two or more records stack, each record's name is written over it. A page written from the
figure takes the records' names, joined by commas, as its title.

## Options

A figure takes the [options](../api.md#options) a record takes, once, and draws every record
with them.

- molviz checks each option against each record. A `span` must fit every record, and
  `"map": "circle"` needs every record to be circular and drawn whole.
- A name in `highlight` must name something in at least one record.
- An option left out takes its default for each record on its own. Each circular record drawn
  whole is a circle, and each record shows the enzymes that cut it once.
- A problem that only some records have names them after its path, such as
  `options.span.end (records[0])`.
