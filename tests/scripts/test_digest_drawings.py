import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

import molviz

SCRIPT = Path(__file__).parents[2] / "scripts" / "digest_drawings.py"
INPUTS: dict[str, dict[str, Any]] = {
    "records": {
        "b-second": {"name": "pB", "circular": False, "bases": "ACGT" * 25},
        "a-first": {"name": "pA", "circular": True, "bases": "GATC" * 25},
    },
    "gels": {"a-first": {"ladder": {"name": "ladder", "bands": [100]}, "lanes": []}},
    "plates": {"a-first": {"rows": 1, "columns": 2, "wells": {"A1": "water"}}},
    "figures": {"a-first": {"records": ["b-second", "a-first"], "options": {"map": "line"}}},
}


def draw_figure(figure: dict[str, Any]) -> molviz.Drawing:
    records = [INPUTS["records"][stem] for stem in figure["records"]]
    return molviz.draw_figure(records, **figure["options"])


# Each set of drawings the script digests: the folder it draws, and how it draws one.
DRAW = {
    "records": ("records", molviz.draw),
    "sequence-views": ("records", lambda record: molviz.draw(record, sequence_view=True)),
    "gels": ("gels", molviz.draw_gel),
    "plates": ("plates", molviz.draw_plate),
    "figures": ("figures", draw_figure),
}


def digest(drawing: molviz.Drawing, path: Path) -> str:
    """The SHA-256 of the file ``drawing`` writes to ``path``, or of its still SVG."""
    if path.name.endswith(".still.svg"):
        return hashlib.sha256(drawing.still_svg().encode()).hexdigest()
    drawing.write(path)
    return hashlib.sha256(path.read_bytes()).hexdigest()


# Each input the script draws, as its set's name and its file's stem, sorted by file.
FILES = [
    ("figures", "a-first"),
    ("gels", "a-first"),
    ("plates", "a-first"),
    ("records", "a-first"),
    ("records", "b-second"),
    ("sequence-views", "a-first"),
    ("sequence-views", "b-second"),
]
ENDINGS = (".html", ".pdf", ".png", ".still.svg", ".svg")


@pytest.fixture(scope="module")
def digested(tmp_path_factory) -> list[str]:
    """The lines the script writes for `INPUTS`, run once for every test of them."""
    tests = tmp_path_factory.mktemp("tests")
    for folder, inputs in INPUTS.items():
        (tests / folder).mkdir()
        for stem, value in inputs.items():
            (tests / folder / f"{stem}.json").write_text(json.dumps(value), encoding="utf-8")
    output = tests / "drawings.sha256"
    subprocess.run([sys.executable, SCRIPT, "--tests", tests, output], check=True)
    return output.read_text(encoding="utf-8").splitlines()


def test_one_line_per_input_and_ending_sorted_by_file(digested) -> None:
    assert [line.split("  ", 1)[1] for line in digested] == [
        f"{name}/{stem}{ending}" for name, stem in FILES for ending in ENDINGS
    ]


@pytest.mark.parametrize(("name", "stem"), FILES)
def test_each_input_and_ending_gets_its_sha256(digested, tmp_path, name, stem) -> None:
    folder, draw = DRAW[name]
    drawing = draw(INPUTS[folder][stem])
    files = [f"{name}/{stem}{ending}" for ending in ENDINGS]
    expected = [
        f"{digest(drawing, tmp_path / f'w{ending}')}  {file}"
        for ending, file in zip(ENDINGS, files, strict=True)
    ]
    assert [line for line in digested if line.split("  ", 1)[1] in files] == expected
