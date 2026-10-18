"""Checking a gel and drawing it, with the viewer's own code."""

from typing import Any

from molviz._runtime import call
from molviz.drawing import Drawing


def check_gel(gel: dict[str, Any]) -> None:
    """Check ``gel`` against the gel format, with the viewer's own check.

    Raises
    ------
    ValueError
        If the gel breaks the format. The message names every problem by its path.
    TypeError
        If a value has no JSON form, such as a set.

    Examples
    --------
    >>> check_gel({"ladder": {"name": "100 bp", "bands": [100, 0]}, "lanes": []})
    Traceback (most recent call last):
    ...
    ValueError: ladder.bands[1]: must be 1 or more
    """
    call("gel", "check", gel)


def draw_gel(gel: dict[str, Any]) -> Drawing:
    """Draw ``gel``, checking it with the viewer.

    Ladder sizes that would crowd are left out and not counted, so the drawing's ``hidden``
    stays empty and its ``notice`` blank. A page written from it takes the gel's title, or
    "Gel" when it has none.

    Raises
    ------
    ValueError
        If the gel breaks the format. The message names every problem by its path.
    TypeError
        If a value has no JSON form, such as a set.

    Examples
    --------
    >>> gel = {
    ...     "title": "PCR products",
    ...     "ladder": {"name": "NEB 100 bp DNA Ladder (N3231)", "bands": [100, 200, 300]},
    ...     "lanes": [{"name": "GFP", "bands": [741]}, {"name": "empty vector", "bands": []}],
    ... }
    >>> draw_gel(gel).write("gel.pdf")  # doctest: +SKIP
    """
    drawn = call("gel", "svg", gel)
    return Drawing("gel", gel, drawn, gel.get("title") or "Gel")
