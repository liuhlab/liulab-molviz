# Gel format

A gel is a simulated agarose gel: a ladder and sample lanes, each band at its size in base
pairs. It holds no record. In Python a gel is a `dict`, which
[`molviz.check_gel`](../api.md#molviz.check_gel) checks and
[`molviz.draw_gel`](../api.md#molviz.draw_gel) draws. In a page it is a JSON object, which the
global [`molviz.checkGel`](javascript.md#check) checks and
[`molviz.drawGel`](javascript.md#draw-into-an-element) draws. Both run the same check.

The check reports every problem it finds, each named by its path, such as
`ladder.bands[1]: must be 1 or more`. Python raises `ValueError`, and the page's check throws a
[`FormatError`](javascript.md#formaterror). A key that is not on this page is an error. The
types are the ones on the [record format](record.md#types) page.

[Draw a gel](../how-to/draw-a-gel.md) writes a gel in this format and draws it.

## Example

This is the colony PCR gel of pUC19-GFP: a correct clone and an empty vector beside a 100 bp
ladder.

```json
--8<-- "tests/gels/golden-gate-colony-pcr.json"
```

## The gel

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `title` | text | no | none | The title drawn over the gel. A page written from the gel takes it as the page's title, or "Gel" when there is none. |
| `ladder` | [ladder](#ladder) | yes | | The size marker in the first lane. |
| `lanes` | list of [lanes](#lanes) | yes | | The sample lanes, left to right after the ladder. The list may be empty. |

## Ladder

`ladder` is an object with these keys.

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `name` | text | yes | | The ladder's name, such as `NEB 100 bp DNA Ladder (N3231)`. |
| `bands` | list of integers, each 1 or more, at least one | yes | | The ladder's band sizes in base pairs. |

The drawing marks the ladder's lane `L` and writes the ladder's sizes beside the gel. It leaves
out the label of a size that would crowd the one above it, and does not count it. It still
draws that size's band.

## Lanes

Each item of `lanes` is an object with these keys.

| Key | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `name` | text | yes | | The lane's name, written in the legend. |
| `bands` | list of integers, each 1 or more | yes | | The lane's band sizes in base pairs. An empty list is a lane with no band. |

The drawing numbers the lanes from `1` in the order given. Each lane has a line in the legend
under the gel, with its name and its sizes in the order given, or "no band".

## Where a band runs

A band's height follows the logarithm of its size. The largest band on the gel, in any lane,
runs the least far and the smallest runs the farthest. When every band on the gel has one size,
each runs halfway.
