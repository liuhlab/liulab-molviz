"""The viewer's JavaScript, run in V8 inside this process."""

import json
from typing import Any

from molviz.viewer import viewer_script

_CHECK = """((text) => {
    try {
        molviz.check(JSON.parse(text));
        return null;
    } catch (error) {
        if (error.name === "FormatError") return error.message;
        throw error;
    }
})"""


def check(record: dict[str, Any]) -> None:
    """Check ``record`` against the format, with the viewer's own check.

    Any JavaScript error other than a format error is raised as it is, not as ``ValueError``.

    Raises
    ------
    ValueError
        If the record breaks the format. The message names every problem by its path.
    TypeError
        If a value has no JSON form, such as a set.
    """
    from py_mini_racer import MiniRacer

    text = json.dumps(record, allow_nan=False)
    with MiniRacer() as ctx:
        ctx.eval(viewer_script())
        problems = ctx.call(_CHECK, text)
    if problems is not None:
        raise ValueError(problems)
