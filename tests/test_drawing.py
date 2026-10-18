import re

import pytest

import molviz
from molviz import Drawing, check

GOOD = {"name": "pUC19", "circular": True, "bases": "GATCcatgRYN"}


def test_a_good_record_passes() -> None:
    check(GOOD)


def test_a_bad_record_raises_the_viewers_message() -> None:
    message = (
        'bases: has "X" at index 3, which is not an IUPAC nucleotide letter\ncolour: unknown key'
    )
    with pytest.raises(ValueError, match=f"^{re.escape(message)}$"):
        check({**GOOD, "bases": "ACGX", "colour": "red"})


def test_a_proto_key_is_a_key_not_a_prototype() -> None:
    with pytest.raises(ValueError, match=r"^__proto__: unknown key$"):
        check({**GOOD, "__proto__": None})


def test_a_record_with_every_kind_passes() -> None:
    check(
        {
            "name": "pUC19 fragment",
            "circular": True,
            "bases": "ACGT" * 25,
            "features": [
                {
                    "name": "lacZ",
                    "type": "CDS",
                    "strand": -1,
                    "segments": [{"start": 90, "end": 98}, {"start": 101, "end": 108}],
                    "color": "#1f77b4",
                    "translation": "MTM*",
                    "codon_start": 2,
                }
            ],
            "primers": [
                {
                    "name": "M13-fwd",
                    "bases": "gatcaGTAAAACGACGGCCAGTG",
                    "sites": [{"start": 95, "end": 105, "strand": 1, "mismatches": [2]}],
                }
            ],
            "cuts": [{"enzyme": "EcoRI", "start": 98, "end": 104, "at": 99, "stagger": 4}],
            "insertions": [{"name": "attB1", "at": 0, "length": 25, "color": "#00ff00"}],
        }
    )


def test_draw_returns_a_drawing_that_hides_nothing() -> None:
    drawing = molviz.draw(GOOD, map="line", types_off=[])
    assert isinstance(drawing, Drawing)
    assert drawing.hidden == []
    assert drawing.notice == ""


def test_draw_rejects_an_unknown_option_by_name() -> None:
    with pytest.raises(ValueError, match=r"^options\.bogus: unknown key$"):
        molviz.draw(GOOD, bogus=1)
