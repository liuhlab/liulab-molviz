# Plate format

A plate is a grid of wells in rows and columns, with what each well holds. It holds no record.
In Python a plate is a `dict`, which [`molviz.check_plate`](../api.md#molviz.check_plate)
checks and [`molviz.draw_plate`](../api.md#molviz.draw_plate) draws. In a page it is a JSON
object, which the global [`molviz.checkPlate`](javascript.md#check) checks and
[`molviz.drawPlate`](javascript.md#draw-into-an-element) draws. Both run the same check.

The check reports every problem it finds, each named by its path, such as
`wells.I1: not on the plate, which runs A1 to H12`. Python raises `ValueError`, and the page's
check throws a [`FormatError`](javascript.md#formaterror). A key that is not on this page is an
error. The types are the ones on the [record format](record.md#types) page.

[Draw a plate and a stamp](../how-to/draw-a-plate.md) writes plates in this format, a stamp
among them, and draws them.

## Example

This 96-well plate holds three clones in its first row and water in its last well.

```json
{
  "title": "Colony picks",
  "rows": 8,
  "columns": 12,
  "wells": {
    "A1": "clone 1",
    "A2": "clone 2",
    "A3": "clone 3",
    "H12": "water"
  }
}
```

## The plate

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `title` | text | no | none | The title drawn over the plate. A page written from the plate takes it as the page's title, or "Plate" when there is none. |
| `rows` | integer, 1 or more | yes | | How many rows the plate has, lettered from `A` at the top. |
| `columns` | integer, 1 or more | yes | | How many columns it has, numbered from `1` at the left. |
| `wells` | [wells](#wells) | no | every well empty | What each well holds, by the well's name. |

Common plates have these sizes.

| Plate | `rows` | `columns` | Last well |
| --- | --- | --- | --- |
| 96 wells | `8` | `12` | `H12` |
| 384 wells | `16` | `24` | `P24` |
| 1,536 wells | `32` | `48` | `AF48` |

## Wells

`wells` is an object. Each key names a well, and its value is what the well holds.

| Part | Type | Meaning |
| --- | --- | --- |
| key | text | A well's name: its row's letters, then its column's number, such as `B3`. The rows after `Z` are `AA`, `AB` and on. The letters are capitals and the number has no leading zero. The well is on the plate. |
| value | text, not blank | What the well holds, such as a sample's name. Wells with the same text hold the same contents. |

A well that is not in `wells` is empty and drawn grey.

## Colours and the legend

Each different contents takes a colour, given out in reading order: across the first row, then
the next. A legend under the plate gives each colour's contents. A plate with more than ten
different contents draws every well that holds something in one colour, and its legend has one
line that gives the count, such as `11 different contents, all one colour`.

## Stamps

The format has no stamp. A stamp's drawing is two plates: the plate it takes from and the
plate it fills. [Draw a stamp as two plates](../how-to/draw-a-plate.md#draw-a-stamp-as-two-plates)
builds them.
