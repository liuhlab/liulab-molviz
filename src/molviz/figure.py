"""Drawing a figure, records stacked, with the viewer's own code."""

from typing import Any

from molviz._runtime import call
from molviz.drawing import Drawing


def draw_figure(records: list[dict[str, Any]], **options: Any) -> Drawing:
    """Draw ``records`` stacked top to bottom, each with ``options``, checking all with the viewer.

    The options are `draw`'s, shared by every record. A name to highlight must name something
    in at least one record. A page written from it is titled with the records' names, joined by
    commas.

    Raises
    ------
    ValueError
        If a record breaks the format, or else if an option is unknown or wrong for any record.
        The message names every problem by its path, a record's under ``records``.
    TypeError
        If a value has no JSON form, such as a set.

    Examples
    --------
    >>> p = {"name": "p", "circular": False, "bases": "ACGT"}
    >>> draw_figure([p, {**p, "name": "q"}], highlight=["lacZ"])
    Traceback (most recent call last):
    ...
    ValueError: options.highlight[0]: names nothing in any record
    """
    call("figure", "check", records, options)
    title = ", ".join(record["name"] for record in records)
    return Drawing("figure", records, title, options)
