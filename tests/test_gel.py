import json
import re

import pytest

import molviz

GOOD = {
    "title": "PCR products",
    "ladder": {"name": "NEB 100 bp DNA Ladder (N3231)", "bands": [100, 200, 300]},
    "lanes": [{"name": "GFP", "bands": [741]}, {"name": "empty vector", "bands": []}],
}


def test_a_good_gel_passes() -> None:
    molviz.check_gel(GOOD)


def test_a_bad_gel_raises_the_viewers_message() -> None:
    message = "ladder.bands: must hold at least one band\nlanes[0].label: unknown key"
    with pytest.raises(ValueError, match=f"^{re.escape(message)}$"):
        molviz.check_gel(
            {
                **GOOD,
                "ladder": {"name": "none", "bands": []},
                "lanes": [{**GOOD["lanes"][0], "label": "GFP"}],
            }
        )


ENDINGS = [".html", ".svg", ".png", ".pdf"]


def test_draw_gel_returns_a_drawing_that_hides_nothing() -> None:
    drawing = molviz.draw_gel(GOOD)
    assert isinstance(drawing, molviz.Drawing)
    assert drawing.hidden == []
    assert drawing.notice == ""


@pytest.mark.parametrize(
    ("ending", "starts"),
    [(".html", b"<!doctype html>"), (".svg", b"<svg "), (".png", b"\x89PNG"), (".pdf", b"%PDF-")],
)
def test_a_gel_writes_each_ending(tmp_path, ending, starts) -> None:
    molviz.draw_gel(GOOD).write(tmp_path / f"gel{ending}")
    assert (tmp_path / f"gel{ending}").read_bytes().startswith(starts)


@pytest.mark.parametrize("ending", ENDINGS)
def test_a_gel_drawn_twice_writes_the_same_bytes(tmp_path, ending) -> None:
    molviz.draw_gel(GOOD).write(tmp_path / f"first{ending}")
    molviz.draw_gel(GOOD).write(tmp_path / f"second{ending}")
    assert (tmp_path / f"first{ending}").read_bytes() == (tmp_path / f"second{ending}").read_bytes()


def test_a_gel_page_holds_the_gel_once_and_draws_it_with_draw_gel(tmp_path) -> None:
    molviz.draw_gel(GOOD).write(tmp_path / "gel.html")
    page = (tmp_path / "gel.html").read_text(encoding="utf-8")
    blocks = re.findall(r'<script type="application/json" id="gel">(.*?)</script', page)
    assert [json.loads(block) for block in blocks] == [GOOD]
    assert 'molviz.drawGel(document.getElementById("drawing"), data("gel"));' in page
    assert "<title>PCR products</title>" in page


def test_an_untitled_gels_page_is_titled_gel(tmp_path) -> None:
    gel = {key: value for key, value in GOOD.items() if key != "title"}
    molviz.draw_gel(gel).write(tmp_path / "gel.html")
    assert "<title>Gel</title>" in (tmp_path / "gel.html").read_text(encoding="utf-8")


def test_draw_gel_raises_the_viewers_message_on_a_bad_gel() -> None:
    with pytest.raises(ValueError, match=r"^lanes\[0\]\.bands: missing$"):
        molviz.draw_gel({**GOOD, "lanes": [{"name": "GFP"}]})
