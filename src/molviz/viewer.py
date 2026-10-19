"""The built viewer, the JavaScript file this package carries."""

from functools import cache
from importlib.resources import files


def viewer_script() -> str:
    """Return the viewer's JavaScript, for a page to inline in a ``<script>`` element.

    Running it defines one global, ``molviz``. The same release returns the same text.

    Raises
    ------
    FileNotFoundError
        If the viewer was never built: ``pixi run build-js`` writes it.
    """
    return files("molviz").joinpath("viewer.js").read_text(encoding="utf-8")


@cache
def font_rules() -> str:
    """Return the CSS a page writes once, in a ``<style>`` element, for its still drawings.

    It is an ``@font-face`` rule for each of the viewer's faces, each loading its face from a
    data URL, so the page needs no network. The same release returns the same text.

    Raises
    ------
    FileNotFoundError
        If the viewer was never built: ``pixi run build-js`` writes it.
    """
    from py_mini_racer import MiniRacer

    with MiniRacer() as ctx:
        ctx.eval(viewer_script())
        return str(ctx.eval("molviz.fontRules()"))
