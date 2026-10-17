"""The viewer's JavaScript, run in V8 inside this process."""

from typing import Any

from molviz.viewer import viewer_script

# Returns the check's message, or null for a good record. Any other error stays a JS error.
_CHECK = """((record) => {
    try {
        molviz.check(record);
        return null;
    } catch (error) {
        if (error.name === "FormatError") return error.message;
        throw error;
    }
})"""


def check(record: dict[str, Any]) -> None:
    """Check ``record`` against the format, with the viewer's own check.

    Raises
    ------
    ValueError
        If the record breaks the format. The message names every problem by its path.
    """
    from py_mini_racer import MiniRacer

    with MiniRacer() as ctx:
        ctx.eval(viewer_script())
        problems = ctx.call(_CHECK, record)
    if problems is not None:
        raise ValueError(problems)
