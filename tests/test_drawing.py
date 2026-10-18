import copy
import html
import json
import re
import struct
from pathlib import Path
from xml.etree import ElementTree

import pytest

import molviz
from molviz import Drawing, check, viewer_script

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


@pytest.mark.parametrize("ending", [".html", ".svg", ".png", ".pdf"])
def test_a_record_drawn_twice_writes_the_same_bytes(tmp_path, ending) -> None:
    molviz.draw(DRAWN).write(tmp_path / f"first{ending}")
    molviz.draw(DRAWN).write(tmp_path / f"second{ending}")
    first = (tmp_path / f"first{ending}").read_bytes()
    assert first
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


def test_a_page_inlines_the_viewer_and_embeds_the_record_once(drawing, tmp_path) -> None:
    written = page(drawing, tmp_path)
    assert viewer_script() in written
    assert [json.loads(block) for block in embedded(written)].count(DRAWN) == 1
    assert title(written) == "pTest"


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


def test_a_page_loads_nothing_over_the_network(drawing, tmp_path) -> None:
    written = page(drawing, tmp_path)
    assert NETWORK.search('<script src="https://example.org/viewer.js">')
    assert not NETWORK.search(written)


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
