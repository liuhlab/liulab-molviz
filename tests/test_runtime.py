import pytest
from py_mini_racer import JSEvalException

from molviz import _runtime
from molviz._runtime import call, calls, font_rules

GOOD = {"name": "pUC19", "circular": True, "bases": "GATCcatgRYN"}


def test_calls_name_each_inputs_calls_on_the_global() -> None:
    assert calls() == {
        "record": {"check": "check", "draw": "draw", "svg": "svg", "still": "stillSvg"},
        "gel": {"check": "checkGel", "draw": "drawGel", "svg": "gelSvg", "still": "gelStillSvg"},
        "plate": {
            "check": "checkPlate",
            "draw": "drawPlate",
            "svg": "plateSvg",
            "still": "plateStillSvg",
        },
    }


def test_a_call_returns_the_viewers_answer() -> None:
    drawn = call("record", "svg", GOOD, {})
    assert set(drawn) == {"svg", "pages", "hidden", "notice"}
    assert drawn["pages"] == [drawn["svg"]]


def test_a_format_error_raises_value_error_with_the_viewers_message() -> None:
    with pytest.raises(ValueError, match=r"^options: must be an object$"):
        call("record", "svg", GOOD, None)


def test_a_still_call_returns_the_drawing_with_no_pages() -> None:
    drawn = call("record", "still", GOOD, {})
    assert set(drawn) == {"svg", "hidden", "notice"}
    assert "<text " in drawn["svg"]


def test_any_other_javascript_error_raises_as_it_is() -> None:
    with pytest.raises(JSEvalException, match="is not a function"):
        call("record", "no_such_call")


@pytest.fixture
def no_outlines(monkeypatch):
    """Run each call as if the outline script were missing."""

    def missing() -> str:
        raise FileNotFoundError("outlines.js")

    monkeypatch.setattr(_runtime, "outlines_script", missing)
    calls.cache_clear()
    font_rules.cache_clear()
    yield
    calls.cache_clear()
    font_rules.cache_clear()


@pytest.mark.usefixtures("no_outlines")
def test_checking_and_still_drawing_need_no_outline_script() -> None:
    assert call("record", "check", GOOD)["name"] == "pUC19"
    assert "<text " in call("record", "still", GOOD, {})["svg"]
    assert "@font-face" in font_rules()
    assert calls()["record"]["svg"] == "svg"


@pytest.mark.usefixtures("no_outlines")
def test_writing_a_file_needs_the_outline_script() -> None:
    with pytest.raises(FileNotFoundError, match=r"outlines\.js"):
        call("record", "svg", GOOD, {})
