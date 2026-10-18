"""Checking a record and drawing it, with the viewer's own code."""

import html
import json
from os import PathLike
from pathlib import Path
from typing import Any, Literal, TypedDict

from molviz._runtime import call
from molviz.viewer import viewer_script


class Span(TypedDict):
    """A stretch of a record, 0-based and half-open, as the format writes one."""

    start: int
    end: int


class Hidden(TypedDict):
    """A label left out because it would overlap."""

    kind: Literal["features", "primers", "cuts", "insertions"]
    """The kind, by its list's key in the record."""
    name: str
    spans: list[Span]


def check(record: dict[str, Any]) -> None:
    """Check ``record`` against the format, with the viewer's own check.

    Raises
    ------
    ValueError
        If the record breaks the format. The message names every problem by its path.
    TypeError
        If a value has no JSON form, such as a set.

    Examples
    --------
    >>> check({"name": "p", "circular": False, "bases": "ACGX"})
    Traceback (most recent call last):
    ...
    ValueError: bases: has "X" at index 3, which is not an IUPAC nucleotide letter
    """
    call("check", record)


class Drawing:
    """A record drawn with its options, made by `draw`.

    Attributes
    ----------
    hidden : list[Hidden]
        The labels left out of the map because they would overlap: of the map a file draws at
        full size, or of the map a page opens on.
    notice : str
        The sentence that counts the hidden labels, worded by the viewer. Empty when nothing
        hides.
    """

    def __init__(
        self, record: dict[str, Any], options: dict[str, Any], drawn: dict[str, Any]
    ) -> None:
        self._record = record
        self._options = options
        self._svg: str = drawn["svg"]
        self._pages: list[str] = drawn["pages"]
        self.hidden: list[Hidden] = drawn["hidden"]
        self.notice: str = drawn["notice"]

    def write(self, path: str | PathLike[str], dpi: float = 300) -> None:
        """Write the drawing to ``path``, in the format its ending names, in any case.

        The endings are ``.html``, a page that draws the record; ``.svg``; ``.png``, at
        ``dpi`` pixels per inch; and ``.pdf``, with the map on page 1. One unit of the
        drawing is one point, so a PDF page is the drawing's own size and a PNG is that size
        in print, cut to whole pixels.

        Raises
        ------
        ValueError
            If the ending is none of those.
        NotImplementedError
            For a PDF of more than one page.
        """
        path = Path(path)
        match path.suffix.lower():
            case ".html":
                path.write_bytes(_page(self._record, self._options).encode())
            case ".svg":
                path.write_bytes(self._svg.encode())
            case ".png":
                import vl_convert

                # vl-convert ships no type stub, so pyright cannot see its functions.
                png = vl_convert.svg_to_png(self._svg, ppi=dpi)  # pyright: ignore[reportAttributeAccessIssue]
                path.write_bytes(png)
            case ".pdf":
                if len(self._pages) > 1:
                    raise NotImplementedError(
                        f"cannot write {path!s}: a PDF of more than one page is not written yet"
                    )
                import vl_convert

                pdf = vl_convert.svg_to_pdf(self._pages[0])  # pyright: ignore[reportAttributeAccessIssue]
                path.write_bytes(pdf)
            case _:
                raise ValueError(
                    f"cannot write {path!s}: its ending must be .html, .svg, .png or .pdf"
                )


# Characters unsafe in a script element or in JavaScript source, each written as its JSON escape.
_UNSAFE = str.maketrans({c: f"\\u{ord(c):04x}" for c in "<>&\u2028\u2029"})


def _json(value: Any) -> str:
    """Return ``value`` as JSON text that a ``<script>`` element holds as it is."""
    return json.dumps(value, ensure_ascii=False, allow_nan=False).translate(_UNSAFE)


def _page(record: dict[str, Any], options: dict[str, Any]) -> str:
    """Return a page that draws ``record`` with ``options`` offline, the viewer inlined."""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{html.escape(record["name"])}</title>
<style>body{{margin:16px;background:#ffffff;color:#252525}}</style>
</head>
<body>
<div id="drawing"></div>
<script type="application/json" id="record">{_json(record)}</script>
<script type="application/json" id="options">{_json(options)}</script>
<script>{viewer_script()}</script>
<script>
const data = (id) => JSON.parse(document.getElementById(id).textContent);
molviz.draw(document.getElementById("drawing"), data("record"), data("options"));
</script>
</body>
</html>
"""


def draw(record: dict[str, Any], **options: Any) -> Drawing:
    """Draw ``record`` with ``options``, checking both with the viewer.

    The options are defined by the viewer, in ``src/viewer/options.ts``, and passed to it
    as they are. Each one left out takes the viewer's default.

    Raises
    ------
    ValueError
        If the record breaks the format, or else if an option is unknown or wrong. The message
        names every problem by its path, an option's under ``options``.
    TypeError
        If a value has no JSON form, such as a set.

    Examples
    --------
    >>> draw({"name": "p", "circular": False, "bases": "ACGT"}, bogus=1)
    Traceback (most recent call last):
    ...
    ValueError: options.bogus: unknown key
    """
    return Drawing(record, options, call("svg", record, options))
