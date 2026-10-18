"""Checking a plate, with the viewer's own code."""

from typing import Any

from molviz._runtime import call


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
    call("checkPlate", plate)
