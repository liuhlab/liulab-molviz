import copy
import html
import json
import re
import struct
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

import pytest

import molviz
from molviz import Drawing, _runtime, font_rules, viewer_script

ROOT = Path(__file__).parents[1]

DRAWN = {
    "name": "pTest",
    "circular": False,
    "bases": "ACGT" * 25,
    "features": [
        {"name": "lacZ", "type": "CDS", "strand": 1, "segments": [{"start": 10, "end": 60}]}
    ],
}


@pytest.fixture(scope="module")
def drawing() -> Drawing:
    return molviz.draw(DRAWN)


def svg_root(drawing: Drawing, tmp_path: Path) -> ElementTree.Element:
    drawing.write(tmp_path / "root.svg")
    return ElementTree.parse(tmp_path / "root.svg").getroot()


def extent(drawing: Drawing, tmp_path: Path) -> tuple[float, float]:
    root = svg_root(drawing, tmp_path)
    return float(root.get("width", "nan")), float(root.get("height", "nan"))


def png_chunk(data: bytes, name: bytes) -> bytes:
    at = data.index(name)
    (length,) = struct.unpack(">I", data[at - 4 : at])
    return data[at + 4 : at + 4 + length]


def test_svg_writes_the_drawing(drawing, tmp_path) -> None:
    assert svg_root(drawing, tmp_path).tag == "{http://www.w3.org/2000/svg}svg"


@pytest.mark.parametrize(("options", "dpi"), [({}, 300), ({"dpi": 96}, 96)])
def test_a_png_is_dpi_pixels_per_inch(drawing, tmp_path, options, dpi) -> None:
    drawing.write(tmp_path / "map.png", **options)
    data = (tmp_path / "map.png").read_bytes()
    width, height = extent(drawing, tmp_path)
    # vl-convert cuts the size to whole pixels, in single precision.
    assert struct.unpack(">II", png_chunk(data, b"IHDR")[:8]) == pytest.approx(
        (width * dpi / 72, height * dpi / 72), abs=1
    )
    per_metre = round(dpi / 0.0254)
    assert png_chunk(data, b"pHYs") == struct.pack(">IIB", per_metre, per_metre, 1)


def test_a_pdf_page_is_the_drawings_extent_in_points(drawing, tmp_path) -> None:
    drawing.write(tmp_path / "map.pdf")
    boxes = re.findall(rb"/MediaBox\s*\[([^\]]*)\]", (tmp_path / "map.pdf").read_bytes())
    assert [[float(n) for n in box.split()] for box in boxes] == [
        [0, 0, *extent(drawing, tmp_path)]
    ]


# Each ending a drawing writes, with how its file starts.
ENDINGS = {".html": b"<!doctype html>", ".svg": b"<svg ", ".png": b"\x89PNG", ".pdf": b"%PDF-"}

GEL = {
    "title": "PCR products",
    "ladder": {"name": "NEB 100 bp DNA Ladder (N3231)", "bands": [100, 200, 300]},
    "lanes": [{"name": "GFP", "bands": [741]}, {"name": "empty vector", "bands": []}],
}

PLATE = {"title": "picked 1", "rows": 8, "columns": 12, "wells": {"A1": "quarter 1"}}

FIGURE = [DRAWN, {**DRAWN, "name": "pTest 2"}]

# Each draw call with an input it draws, and its page's title.
DRAWS = [
    pytest.param(molviz.draw, DRAWN, "pTest", id="record"),
    pytest.param(
        lambda record: molviz.draw(record, sequence_view=True),
        DRAWN,
        "pTest",
        id="record with its sequence view",
    ),
    pytest.param(molviz.draw_figure, FIGURE, "pTest, pTest 2", id="figure"),
    pytest.param(molviz.draw_gel, GEL, "PCR products", id="gel"),
    pytest.param(molviz.draw_plate, PLATE, "picked 1", id="plate"),
]

# The draws whose page draws live, with the viewer, and those whose page holds the still
# drawing and no viewer.
LIVE = [draw for draw in DRAWS if draw.id in ("record", "record with its sequence view")]
STILL = [draw for draw in DRAWS if draw not in LIVE]


@pytest.fixture
def viewer_calls(monkeypatch) -> list[str]:
    """Each call into the viewer from here on, such as ``check`` or ``svg``, in order."""
    made: list[str] = []
    real = _runtime.call_json

    def watched(name: str, function: str, arguments: str) -> Any:
        made.append(function)
        return real(name, function, arguments)

    monkeypatch.setattr(_runtime, "call_json", watched)
    return made


@pytest.mark.parametrize(("draw", "data", "page_title"), DRAWS)
def test_writing_only_a_page_lays_out_no_file(
    tmp_path, viewer_calls, draw, data, page_title
) -> None:
    draw(data).write(tmp_path / "page.html")
    assert "check" in viewer_calls
    assert "svg" not in viewer_calls


def test_a_drawing_lays_out_once_for_every_file(tmp_path, viewer_calls) -> None:
    drawing = molviz.draw(DRAWN, sequence_view=True)
    for ending in (".svg", ".png", ".pdf"):
        drawing.write(tmp_path / f"map{ending}")
    assert (drawing.hidden, drawing.notice) == ([], "")
    assert viewer_calls.count("svg") == 1


@pytest.mark.parametrize(("draw", "data", "page_title"), DRAWS)
@pytest.mark.parametrize(("ending", "starts"), ENDINGS.items())
def test_an_input_writes_each_ending_the_same_each_time(
    tmp_path, draw, data, page_title, ending, starts
) -> None:
    draw(data).write(tmp_path / f"first{ending}")
    draw(data).write(tmp_path / f"second{ending}")
    first = (tmp_path / f"first{ending}").read_bytes()
    assert first.startswith(starts)
    assert first == (tmp_path / f"second{ending}").read_bytes()


def test_an_ending_matches_whatever_its_case(drawing, tmp_path) -> None:
    drawing.write(tmp_path / "MAP.PDF")
    assert (tmp_path / "MAP.PDF").read_bytes().startswith(b"%PDF-")


@pytest.mark.parametrize("name", ["map.jpg", "map"])
def test_an_unknown_ending_raises_naming_the_endings(drawing, tmp_path, name) -> None:
    with pytest.raises(ValueError, match=r"must be \.html, \.svg, \.png or \.pdf$"):
        drawing.write(tmp_path / name)
    assert not (tmp_path / name).exists()


def page(drawing: Drawing, tmp_path: Path) -> str:
    drawing.write(tmp_path / "map.html")
    return (tmp_path / "map.html").read_text(encoding="utf-8")


def embedded(page: str) -> list[str]:
    """The text of each JSON block on ``page``, read to where the HTML parser ends it."""
    return re.findall(
        r'<script type="application/json"[^>]*>(.*?)</script', page, re.DOTALL | re.IGNORECASE
    )


def title(page: str) -> str:
    found = re.search(r"<title>(.*?)</title>", page, re.DOTALL)
    assert found
    return html.unescape(found[1])


@pytest.mark.parametrize(("draw", "data", "page_title"), LIVE)
def test_a_records_page_inlines_the_viewer_and_draws_the_record_held_once(
    tmp_path, draw, data, page_title
) -> None:
    written = page(draw(data), tmp_path)
    assert viewer_script() in written
    assert [json.loads(block) for block in embedded(written)].count(data) == 1
    assert (
        'molviz.draw(document.getElementById("drawing"), data("record"), data("options"));'
        in written
    )
    assert title(written) == page_title


@pytest.mark.parametrize(("draw", "data", "page_title"), STILL)
def test_a_page_holds_the_still_drawing_and_the_font_rules_and_no_viewer(
    tmp_path, draw, data, page_title
) -> None:
    drawing = draw(data)
    written = page(drawing, tmp_path)
    assert "<script" not in written.lower()
    assert written.count(font_rules()) == 1
    assert written.count(drawing.still_svg()) == 1
    assert title(written) == page_title


def test_a_page_holds_the_record_and_options_as_checked(tmp_path) -> None:
    record = copy.deepcopy(DRAWN)
    types_off = ["CDS"]
    drawing = molviz.draw(record, types_off=types_off)
    record["features"][0]["segments"][0]["end"] = 1000
    record["name"] = "changed"
    types_off.append("misc_feature")
    written = page(drawing, tmp_path)
    assert [json.loads(block) for block in embedded(written)] == [DRAWN, {"types_off": ["CDS"]}]
    assert title(written) == "pTest"


# A `src` or `href`, or a CSS `url(` or `@import`, naming a URL with a host.
NETWORK = re.compile(
    r"""(?:\b(?:src|href)\s*=\s*|\burl\(\s*|@import\s+)["']?\s*(?:https?:)?//""", re.IGNORECASE
)


@pytest.mark.parametrize(("draw", "data", "page_title"), DRAWS)
def test_a_page_loads_nothing_over_the_network(tmp_path, draw, data, page_title) -> None:
    written = page(draw(data), tmp_path)
    assert NETWORK.search('<script src="https://example.org/viewer.js">')
    assert not NETWORK.search(written)


@pytest.mark.parametrize(("draw", "data", "page_title"), DRAWS)
def test_a_page_declares_a_light_colour_scheme(tmp_path, draw, data, page_title) -> None:
    written = page(draw(data), tmp_path)
    assert '<meta name="color-scheme" content="light">' in written


def test_the_font_rules_load_each_face_from_the_rules_themselves() -> None:
    rules = font_rules()
    sources = re.findall(r"url\(([^)]*)\)", rules)
    assert len(sources) == rules.count("@font-face") > 0
    assert all(source.startswith("data:") for source in sources)


def test_a_still_svg_writes_each_label_as_text(drawing) -> None:
    still = drawing.still_svg()
    assert still.startswith("<svg ")
    for label in ["lacZ", "pTest", "100 bp"]:
        assert f">{label}</text>" in still


def test_a_still_svg_shows_the_notice_of_what_the_drawing_hid() -> None:
    record = json.loads((ROOT / "tests" / "records" / "ap1-product.json").read_text("utf-8"))
    every = sorted({cut["enzyme"] for cut in record["cuts"]})
    drawing = molviz.draw(record, enzymes=every)
    assert drawing.notice
    assert f">{drawing.notice}<title>" in drawing.still_svg()


def test_a_page_escapes_a_name_that_would_end_its_script(tmp_path) -> None:
    record = {**DRAWN, "name": "</script><script>alert(1)</script><!-- & \u2028\u2029"}
    written = page(molviz.draw(record), tmp_path)
    blocks = embedded(written)
    assert [json.loads(block) for block in blocks].count(record) == 1
    for block in blocks:
        assert not set(block) & set("<>&\u2028\u2029")
    assert title(written) == record["name"]


def test_a_pdf_embeds_no_font(drawing, tmp_path) -> None:
    drawing.write(tmp_path / "map.pdf")
    assert b"/Font" not in (tmp_path / "map.pdf").read_bytes()


ROWS = {**DRAWN, "bases": "ACGT" * 1000}


def test_a_pdf_has_the_map_then_the_rows_on_pages_as_wide_as_the_view(tmp_path) -> None:
    import pypdf

    molviz.draw(ROWS, sequence_view=True).write(tmp_path / "rows.pdf")
    pages = pypdf.PdfReader(tmp_path / "rows.pdf").pages
    sizes = [(float(page.mediabox.width), float(page.mediabox.height)) for page in pages]
    first, *rows = sizes
    assert first == pytest.approx(extent(molviz.draw(ROWS), tmp_path), abs=0.01)
    assert len(rows) > 1
    assert {width for width, _ in rows} == {rows[0][0]}
    assert max(height for _, height in rows) <= rows[0][0] * 2**0.5


def test_a_png_too_large_to_draw_is_refused_pointing_at_the_pdf(drawing, tmp_path) -> None:
    with pytest.raises(ValueError, match=r"write a PDF"):
        drawing.write(tmp_path / "map.png", dpi=10_000)
    assert not (tmp_path / "map.png").exists()
