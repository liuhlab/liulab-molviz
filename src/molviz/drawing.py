"""A drawing, as each input's draw call returns it, and the files it writes."""

import html
import io
import json
import math
import re
from collections.abc import Sequence
from functools import cached_property
from os import PathLike
from pathlib import Path
from typing import Any

from molviz import _runtime
from molviz._runtime import calls, font_rules
from molviz.viewer import viewer_script

# The largest PNG drawn: past this many pixels a side, vl-convert places shapes off where they
# were laid out, and past this many in all it may run out of memory.
_PNG_SIDE = 2**22
_PNG_PIXELS = 2**28

_POINTS_PER_INCH = 72

# The inputs whose page draws live, with the viewer; any other's page holds its still drawing.
_LIVE = frozenset({"record"})


class Drawing:
    """An input drawn, as each of molviz's draw calls returns it. A caller never makes one.

    It lays out its file drawing the first time a ``.svg``, ``.png`` or ``.pdf`` file,
    ``hidden`` or ``notice`` needs it, and only once.
    """

    def __init__(
        self,
        name: str,
        data: dict[str, Any] | list[dict[str, Any]],
        title: str,
        options: dict[str, Any] | None = None,
    ) -> None:
        # `data` is the input called `name`, already checked. A page titled `title` hands that
        # input's draw call `data`, then any `options`.
        self._name = name
        # Each argument of the draw call by its block's id on a page. As text, so a change the
        # caller makes to an input afterwards never reaches the page or a file.
        given = {name: data} if options is None else {name: data, "options": options}
        self._arguments = {block: _json(value) for block, value in given.items()}
        self._title = title

    @property
    def hidden(self) -> list[dict[str, Any]]:
        """The labels left out because they would overlap.

        They are of what a file draws at full size, or of what a page opens on. Each is the
        viewer's ``Hidden``, defined in its ``labels.ts``: its ``kind``, ``name``, and ``spans``
        or, for a cut site, an insertion or a disagreement at a point, its point ``at``.
        """
        return self._drawn["hidden"]

    @property
    def notice(self) -> str:
        """The sentence that counts the hidden labels by kind, worded by the viewer.

        Such as "3 cut sites and 1 primer are hidden". Empty when nothing hides.
        """
        return self._drawn["notice"]

    @cached_property
    def _drawn(self) -> dict[str, Any]:
        """The viewer's file drawing: ``svg``, its PDF ``pages``, ``hidden`` and ``notice``."""
        return _runtime.call_json(self._name, "svg", self._array())

    def _array(self) -> str:
        """Return the draw call's arguments, as one JSON array."""
        return f"[{','.join(self._arguments.values())}]"

    def write(self, path: str | PathLike[str], dpi: float = 300) -> None:
        """Write the drawing to ``path``, in the format its ending names, in any case.

        The endings are ``.html``, a page that opens offline; ``.svg``; ``.png``, at ``dpi``
        pixels per inch; and ``.pdf``. One unit of the drawing is one point, so a PDF page is
        the drawing's own size and a PNG is that size in print, cut to whole pixels. A PDF of a
        record with its sequence view has the map on the first page and the rows on the pages
        after. A record's page draws it with the viewer; any other page holds its still SVG and
        no viewer.

        Raises
        ------
        ValueError
            If the ending is none of those, or if a PNG at ``dpi`` would pass 2**22 pixels on a
            side or 2**28 in all.
        """
        path = Path(path)
        match path.suffix.lower():
            case ".html":
                if self._name in _LIVE:
                    page = _page(self._title, self._name, self._arguments)
                else:
                    page = _still_page(self._title, self.still_svg())
                path.write_bytes(page.encode())
            case ".svg":
                path.write_bytes(self._drawn["svg"].encode())
            case ".png":
                most = _most_dpi(self._drawn["svg"])
                if dpi > most:
                    raise ValueError(
                        f"cannot write {path!s}: a PNG of this drawing is drawn at up to "
                        f"{math.floor(most):,} dpi, not {dpi:g}; write a PDF, which draws at any size"
                    )
                import vl_convert

                # vl-convert ships no type stub, so pyright cannot see its functions.
                png = vl_convert.svg_to_png(self._drawn["svg"], ppi=dpi)  # pyright: ignore[reportAttributeAccessIssue]
                path.write_bytes(png)
            case ".pdf":
                path.write_bytes(_pdf(self._drawn["pages"]))
            case _:
                raise ValueError(
                    f"cannot write {path!s}: its ending must be .html, .svg, .png or .pdf"
                )

    def still_svg(self) -> str:
        """Return the drawing as SVG with real text, for a page that holds no viewer.

        It is laid out as the ``.svg`` file is and hides the same labels. Each text is held to
        its measured width, and each hover is a ``<title>``. It draws in the viewer's faces
        only on a page that writes ``font_rules()`` once, in a ``<style>`` element.
        """
        return _runtime.call_json(self._name, "still", self._array())["svg"]


def _most_dpi(svg: str) -> float:
    """Return the highest dpi a PNG of ``svg`` is drawn at, from the size its root gives."""
    root = re.match(r'<svg [^>]*?width="([^"]+)" height="([^"]+)"', svg)
    assert root, "the viewer writes an SVG's width and height on its root"
    width, height = (float(n) / _POINTS_PER_INCH for n in root.groups())
    return min(_PNG_SIDE / max(width, height), math.sqrt(_PNG_PIXELS / (width * height)))


def _pdf(pages: Sequence[str]) -> bytes:
    """Return a PDF with each SVG of ``pages`` on a page of its own."""
    import vl_convert

    if len(pages) == 1:
        return vl_convert.svg_to_pdf(pages[0])  # pyright: ignore[reportAttributeAccessIssue]
    import pypdf

    joined = pypdf.PdfWriter()
    for page in pages:
        pdf = vl_convert.svg_to_pdf(page)  # pyright: ignore[reportAttributeAccessIssue]
        joined.append(pypdf.PdfReader(io.BytesIO(pdf)))
    out = io.BytesIO()
    joined.write(out)
    return out.getvalue()


# Characters unsafe in a script element or in JavaScript source, each written as its JSON escape.
_UNSAFE = str.maketrans({c: f"\\u{ord(c):04x}" for c in "<>&\u2028\u2029"})


def _json(value: Any) -> str:
    """Return ``value`` as JSON text that a ``<script>`` element holds as it is."""
    return json.dumps(value, ensure_ascii=False, allow_nan=False).translate(_UNSAFE)


def _page(title: str, name: str, texts: dict[str, str]) -> str:
    """Return a page titled ``title`` that draws offline, with the viewer's draw call for ``name``.

    It hands that call the element to draw in, then each of ``texts``, JSON text by its block's
    id, in order.
    """
    blocks = "".join(
        f'<script type="application/json" id="{block}">{text}</script>\n'
        for block, text in texts.items()
    )
    arguments = "".join(f', data("{block}")' for block in texts)
    return _document(
        title,
        f"""<div id="drawing"></div>
{blocks}<script>{viewer_script()}</script>
<script>
const data = (id) => JSON.parse(document.getElementById(id).textContent);
molviz.{calls()[name]["draw"]}(document.getElementById("drawing"){arguments});
</script>
""",
    )


def _still_page(title: str, svg: str) -> str:
    """Return a page titled ``title`` that holds the still drawing ``svg`` and the font rules."""
    return _document(title, f'<div id="drawing">{svg}</div>\n', font_rules())


def _document(title: str, body: str, style: str = "") -> str:
    """Return a page titled ``title`` holding ``body``, with any ``style`` after the page's own."""
    style = f"\n{style}" if style else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{html.escape(title)}</title>
<style>body{{margin:16px;background:#ffffff;color:#252525}}{style}</style>
</head>
<body>
{body}</body>
</html>
"""
