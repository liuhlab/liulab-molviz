"""Checking a plate and drawing it, with the viewer's own code."""

from typing import Any

from molviz._runtime import call
from molviz.drawing import Drawing


def check_plate(plate: dict[str, Any]) -> None:
    """Check ``plate`` against the plate format, with the viewer's own check.

    Raises
    ------
    ValueError
        If the plate breaks the format. The message names every problem by its path.
    TypeError
        If a value has no JSON form, such as a set.

    Examples
    --------
    >>> check_plate({"rows": 8, "columns": 12, "wells": {"I1": "water"}})
    Traceback (most recent call last):
    ...
    ValueError: wells.I1: not on the plate, which runs A1 to H12
    """
    call("plate", "check", plate)


def draw_plate(plate: dict[str, Any]) -> Drawing:
    """Draw ``plate``, checking it with the viewer.

    The drawing's ``hidden`` is empty and its ``notice`` blank. A page written from it takes
    the plate's title, or "Plate" when it has none.

    Raises
    ------
    ValueError
        If the plate breaks the format. The message names every problem by its path.
    TypeError
        If a value has no JSON form, such as a set.

    Examples
    --------
    >>> plate = {"title": "picked 1", "rows": 8, "columns": 12, "wells": {"A1": "water"}}
    >>> draw_plate(plate).write("plate.pdf")  # doctest: +SKIP
    """
    drawn = call("plate", "svg", plate)
    return Drawing("plate", plate, drawn, plate.get("title") or "Plate")
