"""Checking a record and drawing it, with the viewer's own code."""

from os import PathLike
from typing import Any, Literal, TypedDict

from molviz._runtime import call


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
        """Write the drawing to ``path``, in the format its ending names.

        The endings are ``.html``, a page that draws the record; ``.svg``; ``.png``, at
        ``dpi`` pixels per inch; and ``.pdf``, with the map on page 1.

        Raises
        ------
        NotImplementedError
            For every format, for now.
        """
        raise NotImplementedError(f"cannot write {path!s} yet")


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
