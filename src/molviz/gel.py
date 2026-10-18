"""Checking a gel, with the viewer's own code."""

from typing import Any

from molviz._runtime import call


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
    call("checkGel", gel)
