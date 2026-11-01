"""Checking a record and drawing it, with the viewer's own code."""

from typing import Any

from molviz._runtime import call
from molviz.drawing import Drawing

SEQUENCE_VIEW_LIMIT = 100_000
"""The most bases of a span the sequence view draws. Past it, ``draw`` with
``sequence_view=True`` raises ``ValueError``."""


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
    call("record", "check", record)


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
    call("record", "check", record, options)
    return Drawing("record", record, record["name"], options)
