import pytest
from py_mini_racer import JSEvalException

from molviz._runtime import call, calls

GOOD = {"name": "pUC19", "circular": True, "bases": "GATCcatgRYN"}


def test_calls_name_each_inputs_calls_on_the_global() -> None:
    assert calls() == {
        "record": {"check": "check", "draw": "draw", "svg": "svg"},
        "gel": {"check": "checkGel", "draw": "drawGel", "svg": "gelSvg"},
    }


def test_a_call_returns_the_viewers_answer() -> None:
    drawn = call("record", "svg", GOOD, {})
    assert set(drawn) == {"svg", "pages", "hidden", "notice"}
    assert drawn["pages"] == [drawn["svg"]]


def test_a_format_error_raises_value_error_with_the_viewers_message() -> None:
    with pytest.raises(ValueError, match=r"^options: must be an object$"):
        call("record", "svg", GOOD, None)


def test_any_other_javascript_error_raises_as_it_is() -> None:
    with pytest.raises(JSEvalException, match="is not a function"):
        call("record", "no_such_call")
