"""Checking a record and drawing it, with the viewer's own code."""

import html
import json
from os import PathLike
from pathlib import Path
from typing import Any

from molviz._runtime import call
from molviz.viewer import viewer_script


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
    """A record or a gel drawn, made by `draw` or `draw_gel`.

    Parameters
    ----------
    title : str
        The title of a page written from it.
    function : str
        The viewer's function such a page calls to draw it, such as ``draw``.
    inputs : dict[str, Any]
        What the page hands ``function`` after the element to draw in, in order, each by the id of
        the JSON block that holds it.
    drawn : dict[str, Any]
        The viewer's ``Drawing`` of the same inputs, defined in its ``drawing.ts``.

    Attributes
    ----------
    hidden : list[dict[str, Any]]
        The labels left out of the map because they would overlap: of the map a file draws at
        full size, or of the map a page opens on. Each is the viewer's ``Hidden``, defined in
        its ``drawing.ts``: the label's kind, its name and its spans.
    notice : str
        The sentence that counts the hidden labels, worded by the viewer. Empty when nothing
        hides.
    """

    def __init__(
        self, title: str, function: str, inputs: dict[str, Any], drawn: dict[str, Any]
    ) -> None:
        self._title = title
        self._function = function
        # As text, so a change the caller makes to an input afterwards never reaches the page.
        self._inputs = {name: _json(value) for name, value in inputs.items()}
        self._svg: str = drawn["svg"]
        self._pages: list[str] = drawn["pages"]
        self.hidden: list[dict[str, Any]] = drawn["hidden"]
        self.notice: str = drawn["notice"]

    def write(self, path: str | PathLike[str], dpi: float = 300) -> None:
        """Write the drawing to ``path``, in the format its ending names, in any case.

        The endings are ``.html``, a page that draws it; ``.svg``; ``.png``, at ``dpi``
        pixels per inch; and ``.pdf``, with a record's map on page 1. One unit of the drawing
        is one point, so a PDF page is the drawing's own size and a PNG is that size in
        print, cut to whole pixels.

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
                path.write_bytes(_page(self._title, self._function, self._inputs).encode())
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


def _page(title: str, function: str, inputs: dict[str, str]) -> str:
    """Return a page titled ``title`` that draws offline by calling the viewer's ``function``.

    It hands ``function`` the element to draw in, then each of the JSON ``inputs`` in order.
    """
    blocks = "".join(
        f'<script type="application/json" id="{name}">{text}</script>\n'
        for name, text in inputs.items()
    )
    arguments = "".join(f', data("{name}")' for name in inputs)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{html.escape(title)}</title>
<style>body{{margin:16px;background:#ffffff;color:#252525}}</style>
</head>
<body>
<div id="drawing"></div>
{blocks}<script>{viewer_script()}</script>
<script>
const data = (id) => JSON.parse(document.getElementById(id).textContent);
molviz.{function}(document.getElementById("drawing"){arguments});
</script>
</body>
</html>
"""


def draw(record: dict[str, Any], **options: Any) -> Drawing:
    """Draw ``record`` with ``options``, checking both with the viewer.

    The options are the viewer's, passed to it as they are, and each one left out takes its
    default. The API reference lists them: <https://liuhlab.github.io/liulab-molviz/api/#options>.

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
    drawn = call("svg", record, options)
    return Drawing(record["name"], "draw", {"record": record, "options": options}, drawn)
