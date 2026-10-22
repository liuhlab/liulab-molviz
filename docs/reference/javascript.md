# JavaScript API

The viewer is one script. Running it defines one global, `molviz`, and this page lists every
name on it. Python's [`viewer_script()`](../api.md#molviz.viewer.viewer_script) returns the
script's text, for a page to put in a `<script>` element.

## Each input's four calls

Each input has four calls. One checks it, one draws it into an element of a page, one returns
it as SVG for a file, and one returns it as a still SVG.

| Input | Check | Draw into an element | File SVG | Still SVG |
| --- | --- | --- | --- | --- |
| A record | `check` | `draw` | `svg` | `stillSvg` |
| A figure | `checkFigure` | `drawFigure` | `figureSvg` | `figureStillSvg` |
| A gel | `checkGel` | `drawGel` | `gelSvg` | `gelStillSvg` |
| A plate | `checkPlate` | `drawPlate` | `plateSvg` | `plateStillSvg` |

Each call takes the input as a plain object, in the format Python's calls take. A figure's
input is a list of one or more records.

A record's calls and a figure's calls take `options` as one object, such as `{"map": "line"}`.
They are the [options](../api.md#options) that Python's `draw` takes by name. A figure's
options apply to every record in it. A gel's calls and a plate's calls accept `options` and
ignore them. Left out, `options` is `{}`, so each option takes its default.

### Check

```js
molviz.check(record)
```

`check`, `checkFigure`, `checkGel` and `checkPlate` return a checked copy of the input and leave
the input as it was. A record comes back with each list it left out set to `[]`, and so does
each record of a figure.

Each throws a [`FormatError`](#formaterror) when the input breaks its format.

### Draw into an element

```js
molviz.draw(element, record, options)
```

`draw`, `drawFigure`, `drawGel` and `drawPlate` add the drawing at the end of `element`, a DOM
element, after what it already holds. Letters are real text. Each call first adds the font
rules to the page with [`declareFaces`](#declarefaces).

- `draw` opens the record in a frame: a bar of controls, the map, and the sequence view when
  `sequence_view` is `true`.
- `drawFigure`, `drawGel` and `drawPlate` each add one SVG element, with no controls.

Where a span holds more than [`SEQUENCE_VIEW_LIMIT`](#sequence_view_limit) bases, `draw` and
`drawFigure` leave the sequence view out instead of throwing.

Each returns an object with one method, `destroy()`. It removes the drawing and leaves the font
rules for any other drawing on the page. A second call does nothing.

Each throws a `FormatError` that names every problem in the input. When the input is right, the
error names every problem in the options instead.

### File SVG

```js
molviz.svg(record, options)
```

`svg`, `figureSvg`, `gelSvg` and `plateSvg` are for code that writes files. Each letter is an
outline, so the SVG looks the same on a machine without molviz's fonts.

These four calls need the outline script, which ships beside the viewer, to have run first.
Without it, they throw an `Error` whose message is
`molviz: a file's outlines need the outline script`. A page uses the draw calls and the still
calls, which need only the viewer.

Each returns an object with four keys:

| Key | Type | What it holds |
| --- | --- | --- |
| `svg` | string | The whole drawing as SVG text. Its width and height have no unit. One unit is one point. |
| `pages` | array of strings | One SVG for each PDF page. With the sequence view, the map is the first page and the rows follow. Otherwise it holds one SVG, the same as `svg`. |
| `hidden` | array of objects | The labels left out because they would overlap, as [Hidden labels](#hidden-labels) describes. |
| `notice` | string | The hidden-label notice as a sentence, such as `3 cut sites and 1 primer are hidden`. It is empty when nothing hides. |

A gel's `hidden` and a plate's `hidden` are `[]`, and their `notice` is `""`.

Each throws a `FormatError` as the draw calls do. It also throws one when `sequence_view` is
`true` for a span of more than `SEQUENCE_VIEW_LIMIT` bases.

### Still SVG

```js
molviz.stillSvg(record, options)
```

`stillSvg`, `figureStillSvg`, `gelStillSvg` and `plateStillSvg` return an object with the keys
`svg`, `hidden` and `notice`, as the file SVG calls do. It has no `pages`.

The SVG has the same layout as the file SVG. Each text is a `<text>` element, and each hover is
a `<title>`. These calls need only the viewer. Their SVG draws in the viewer's fonts only on a page
that holds the font rules, from [`fontRules`](#fontrules) or [`declareFaces`](#declarefaces).

Each throws as the file SVG calls do.

### Hidden labels

Each item of `hidden` is one label left out because it would overlap. It names the thing the
label belongs to and gives its spans or its point, in the record's own numbers.

| Key | Type | What it holds |
| --- | --- | --- |
| `kind` | string | `"features"`, `"primers"`, `"cuts"`, `"insertions"`, `"reads"` or `"disagreements"`. |
| `name` | string | The thing's name. A cut site's name is its enzymes' names, as in `BanII - SacI`. |
| `spans` | array of `{start, end}` | The spans of a feature, a primer site, a read or a disagreement over a span. |
| `at` | number | The point of a cut site, an insertion or a disagreement at a point. |

Each item has either `spans` or `at`, never both.

## fontRules

```js
molviz.fontRules()
```

Returns the font rules as CSS text: one `@font-face` rule for each of the viewer's fonts. Each
rule loads its font from a data URL, so the page needs no network. A page writes the rules once,
in a `<style>` element, for every still SVG it holds. Python's `font_rules()` returns the same
text.

## declareFaces

```js
molviz.declareFaces(document)
```

Adds the font rules to `document` once, as a `<style id="molviz-fonts">` element at the end of
its `<head>`. A second call finds that element and does nothing. Returns `undefined`.

Every draw call calls it. A script that writes still SVGs into a page can call it too, in place
of writing the font rules itself.

## calls

An object that names each input's four calls, so code can pick a call by the input's name. Its
keys are `record`, `figure`, `gel` and `plate`. Each value is an object with the keys `check`,
`draw`, `svg` and `still`, whose values are names on `molviz`.

```js
const call = molviz.calls.gel.draw; // "drawGel"
molviz[call](element, gel);
```

## SEQUENCE_VIEW_LIMIT

The number `100000`: the most bases of a span that the sequence view draws. Python's
`SEQUENCE_VIEW_LIMIT` is the same number.

## FormatError

The error a call throws when an input or its options break the format. It is an `Error` whose
`name` is `"FormatError"`. The class itself is not on `molviz`, so code tells the error apart by
its `name`.

Its message names every problem by its path, one problem to a line. A problem in the options
has a path that starts with `options`, and a problem in a figure's list has one that starts with
`records`. For example:

- A record whose bases hold an `X`:
  `bases: has "X" at index 3, which is not an IUPAC nucleotide letter`.
- A highlight that names nothing in the record:
  `options.highlight[0]: names nothing in the record`.
- A figure with no records: `records: must hold at least one record`.
