"""The viewer's JavaScript, run in V8 inside this process."""

import json
from functools import cache
from typing import Any

from molviz.viewer import viewer_script

# The arguments cross as JSON text, so a key such as `__proto__` stays a key.
_CALL = """((name, call, text) => {
    try {
        return { value: molviz[molviz.calls[name][call]](...JSON.parse(text)) ?? null };
    } catch (error) {
        if (error.name === "FormatError") return { problems: error.message };
        throw error;
    }
})"""


@cache
def calls() -> dict[str, dict[str, str]]:
    """Return the viewer's ``calls``: each input's calls by their names on the global."""
    from py_mini_racer import MiniRacer

    with MiniRacer() as ctx:
        ctx.eval(viewer_script())
        text = ctx.eval("JSON.stringify(molviz.calls)")
    return json.loads(str(text))


def call(name: str, function: str, *arguments: Any) -> Any:
    """Call the viewer's ``function``, such as ``svg``, for the input ``name`` with ``arguments``.

    It returns the answer as JSON gives it. Each call runs in a fresh V8 context.

    Raises
    ------
    ValueError
        If the viewer throws a format error. The message is the viewer's.
    TypeError
        If an argument has no JSON form, such as a set.
    py_mini_racer.JSEvalException
        If the viewer throws any other error.
    """
    from py_mini_racer import MiniRacer

    text = json.dumps(arguments, allow_nan=False)
    with MiniRacer() as ctx:
        ctx.eval(viewer_script())
        answer = ctx.call(_CALL, name, function, text)
    if "problems" in answer:
        raise ValueError(answer["problems"])
    return answer["value"]
