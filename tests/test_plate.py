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
