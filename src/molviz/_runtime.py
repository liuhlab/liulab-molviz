"""The viewer's JavaScript, run in V8 inside this process."""

import json
from functools import cache
from typing import Any

from molviz.viewer import outlines_script, viewer_script

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
    return json.loads(_evaluated("JSON.stringify(molviz.calls)"))


@cache
def font_rules() -> str:
    """Return the CSS a page writes once, in a ``<style>`` element, for its still drawings.

    It is an ``@font-face`` rule for each of the viewer's faces, each loading its face from a
    data URL, so the page needs no network. The same release returns the same text.

    Raises
    ------
    FileNotFoundError
        If the viewer was never built: ``pixi run build-js`` writes it.
    """
    return _evaluated("molviz.fontRules()")


def _evaluated(expression: str) -> str:
    """Return the value of ``expression`` as text, run after the viewer in a fresh V8 context."""
    from py_mini_racer import MiniRacer

    with MiniRacer() as ctx:
        ctx.eval(viewer_script())
        return str(ctx.eval(expression))


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
    return call_json(name, function, json.dumps(arguments, allow_nan=False))


def call_json(name: str, function: str, arguments: str) -> Any:
    """Call as ``call`` does, with ``arguments`` already written as one JSON array.

    Only an ``svg`` call, which writes a file, runs the outline script too.

    Raises
    ------
    ValueError
        If the viewer throws a format error. The message is the viewer's.
    py_mini_racer.JSEvalException
        If the viewer throws any other error.
    """
    from py_mini_racer import MiniRacer

    with MiniRacer() as ctx:
        ctx.eval(viewer_script())
        if function == "svg":
            ctx.eval(outlines_script())
        answer = ctx.call(_CALL, name, function, arguments)
    if "problems" in answer:
        raise ValueError(answer["problems"])
    return answer["value"]
