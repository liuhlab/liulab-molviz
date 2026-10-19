import pytest

import molviz

P = {"name": "p", "circular": False, "bases": "ACGT"}


def test_draw_figure_names_a_bad_record_by_its_place() -> None:
    with pytest.raises(ValueError, match=r"^records\[1\]\.bases: must hold at least one base$"):
        molviz.draw_figure([P, {**P, "bases": ""}])


def test_draw_figure_refuses_a_sequence_view_past_the_limit() -> None:
    long = {**P, "bases": "ACGT" * 25_001}
    with pytest.raises(ValueError, match=r"^options\.sequence_view: must be false past 100,000"):
        molviz.draw_figure([long], sequence_view=True)
