import json
import re
from pathlib import Path

import pytest

import molviz
from molviz import Drawing, check, viewer_script

ROOT = Path(__file__).parents[1]

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


LIT = {
    **GOOD,
    "features": [
        {"name": "lacZ", "type": "CDS", "strand": 1, "segments": [{"start": 0, "end": 6}]}
    ],
    "cuts": [{"enzyme": "EcoRI", "start": 0, "end": 6, "at": 1, "stagger": 4}],
}


def test_draw_passes_the_kinds_enzymes_and_highlight_through() -> None:
    drawing = molviz.draw(LIT, kinds_off=["primers"], enzymes=["EcoRI"], highlight=["LACZ"])
    assert drawing.hidden == []


def test_draw_returns_the_labels_the_viewer_hid_a_lit_one_last() -> None:
    record = json.loads((ROOT / "tests" / "records" / "ap1-product.json").read_text("utf-8"))
    every = sorted({cut["enzyme"] for cut in record["cuts"]})
    site = {"kind": "cuts", "name": "BtgZI", "at": 1864}
    plain = molviz.draw(record, enzymes=every)
    lit = molviz.draw(record, enzymes=every, highlight=["btgzi"])
    assert len(plain.hidden) == 6
    assert site in plain.hidden
    assert lit.hidden
    assert [one for one in lit.hidden if one["name"] == "BtgZI"] == []
    assert lit.notice == f"{len(lit.hidden)} cut sites are hidden"


def test_draw_rejects_a_highlight_that_names_nothing() -> None:
    with pytest.raises(ValueError, match=r"^options\.highlight\[0\]: names nothing in the record$"):
        molviz.draw(LIT, highlight=["SacI"])


DRAWN = {
    "name": "pTest",
    "circular": False,
    "bases": "ACGT" * 25,
    "features": [
        {"name": "lacZ", "type": "CDS", "strand": 1, "segments": [{"start": 10, "end": 60}]}
    ],
}


def test_draw_opens_a_whole_circular_record_on_the_circle(tmp_path) -> None:
    def svg(**options) -> bytes:
        molviz.draw(GOOD, **options).write(tmp_path / "map.svg")
        return (tmp_path / "map.svg").read_bytes()

    assert svg() == svg(map="circle")
    assert svg() != svg(map="line")
    assert svg(span={"start": 0, "end": 5}) == svg(map="line", span={"start": 0, "end": 5})


def test_draw_rejects_the_circle_of_a_linear_record() -> None:
    message = 'options.map: must be "line" on a linear record'
    with pytest.raises(ValueError, match=f"^{re.escape(message)}$"):
        molviz.draw(DRAWN, map="circle")


def test_a_sequence_view_past_the_limit_is_an_error() -> None:
    long = {**DRAWN, "bases": "ACGT" * 25_001}
    with pytest.raises(ValueError, match=r"^options\.sequence_view: must be false past 100,000"):
        molviz.draw(long, sequence_view=True)


def test_the_sequence_view_limit_is_the_viewers() -> None:
    from py_mini_racer import MiniRacer

    with MiniRacer() as ctx:
        ctx.eval(viewer_script())
        assert ctx.eval("molviz.SEQUENCE_VIEW_LIMIT") == molviz.SEQUENCE_VIEW_LIMIT
