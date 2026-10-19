import pytest

import molviz

P = {"name": "p", "circular": False, "bases": "ACGT"}


def test_draw_figure_names_a_bad_record_by_its_place() -> None:
    with pytest.raises(ValueError, match=r"^records\[1\]\.bases: must hold at least one base$"):
        molviz.draw_figure([P, {**P, "bases": ""}])
