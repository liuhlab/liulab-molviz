import copy
import html
import json
import re
import struct
from pathlib import Path
from xml.etree import ElementTree

import pytest

import molviz
from molviz import Drawing, check, font_rules, viewer_script

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
    record = json.loads((ROOT / "tests" / "records" / "crowded-sites.json").read_text("utf-8"))
    every = sorted({cut["enzyme"] for cut in record["cuts"]})
    site = {"kind": "cuts", "name": "EcoRI", "at": 1275}
    plain = molviz.draw(record, map="line", enzymes=every)
    lit = molviz.draw(record, map="line", enzymes=every, highlight=["ecori"])
    assert site in plain.hidden
    assert lit.hidden
    assert [one for one in lit.hidden if one["name"] == "EcoRI"] == []
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


@pytest.fixture(scope="module")
def drawing() -> Drawing:
    return molviz.draw(DRAWN)


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

# Each draw call with an input it draws, and its page's title.
DRAWS = [
    pytest.param(molviz.draw, DRAWN, "pTest", id="record"),
    pytest.param(
        lambda record: molviz.draw(record, sequence_view=True),
        DRAWN,
        "pTest",
        id="record with its sequence view",
    ),
    pytest.param(molviz.draw_gel, GEL, "PCR products", id="gel"),
    pytest.param(molviz.draw_plate, PLATE, "picked 1", id="plate"),
]

# The draws whose page draws live, with the viewer, and those whose page holds the still
# drawing and no viewer.
LIVE = [draw for draw in DRAWS if draw.id in ("record", "record with its sequence view")]
STILL = [draw for draw in DRAWS if draw not in LIVE]


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
    record = json.loads((ROOT / "tests" / "records" / "crowded-sites.json").read_text("utf-8"))
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


def test_a_sequence_view_past_the_limit_is_an_error() -> None:
    long = {**DRAWN, "bases": "ACGT" * 25_001}
    with pytest.raises(ValueError, match=r"^options\.sequence_view: must be false past 100,000"):
        molviz.draw(long, sequence_view=True)


def test_the_sequence_view_limit_is_the_viewers() -> None:
    from py_mini_racer import MiniRacer

    with MiniRacer() as ctx:
        ctx.eval(viewer_script())
        assert ctx.eval("molviz.SEQUENCE_VIEW_LIMIT") == molviz.SEQUENCE_VIEW_LIMIT
