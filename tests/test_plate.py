import re

import pytest

import molviz

GOOD = {"title": "picked 1", "rows": 16, "columns": 24, "wells": {"A1": "quarter 1"}}


def test_a_good_plate_passes() -> None:
    molviz.check_plate(GOOD)


def test_a_bad_plate_raises_the_viewers_message() -> None:
    message = "wells.A2: must not be empty\nwells.Q1: not on the plate, which runs A1 to P24"
    with pytest.raises(ValueError, match=f"^{re.escape(message)}$"):
        molviz.check_plate({**GOOD, "wells": {"Q1": "quarter 1", "A2": ""}})


def test_draw_plate_returns_a_drawing_that_hides_nothing() -> None:
    drawing = molviz.draw_plate(GOOD)
    assert isinstance(drawing, molviz.Drawing)
    assert drawing.hidden == []
    assert drawing.notice == ""


def test_an_untitled_plates_page_is_titled_plate(tmp_path) -> None:
    plate = {key: value for key, value in GOOD.items() if key != "title"}
    molviz.draw_plate(plate).write(tmp_path / "plate.html")
    assert "<title>Plate</title>" in (tmp_path / "plate.html").read_text(encoding="utf-8")


def test_draw_plate_raises_the_viewers_message_on_a_bad_plate() -> None:
    with pytest.raises(ValueError, match=r"^rows: must be 1 or more$"):
        molviz.draw_plate({**GOOD, "rows": 0, "wells": {}})
