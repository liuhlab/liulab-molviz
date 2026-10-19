"""The built viewer and its outline script, the JavaScript files this package carries."""

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


def outlines_script() -> str:
    """Return the outline script: each glyph's outline, which the viewer needs to write a file.

    Running it defines one global, ``molvizOutlines``. The same release returns the same text.

    Raises
    ------
    FileNotFoundError
        If the viewer was never built: ``pixi run build-js`` writes it.
    """
    return files("molviz").joinpath("outlines.js").read_text(encoding="utf-8")
