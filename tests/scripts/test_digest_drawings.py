import hashlib
import json
import subprocess
import sys
from pathlib import Path

import molviz

SCRIPT = Path(__file__).parents[2] / "scripts" / "digest_drawings.py"
INPUTS = {
    "records": {
        "b-second": {"name": "pB", "circular": False, "bases": "ACGT" * 25},
        "a-first": {"name": "pA", "circular": True, "bases": "GATC" * 25},
    },
    "gels": {"a-first": {"ladder": {"name": "ladder", "bands": [100]}, "lanes": []}},
    "plates": {"a-first": {"rows": 1, "columns": 2, "wells": {"A1": "water"}}},
}
# Each set of drawings the script digests: the folder it draws, and how it draws one.
DRAW = {
    "records": ("records", molviz.draw),
    "sequence-views": ("records", lambda record: molviz.draw(record, sequence_view=True)),
    "gels": ("gels", molviz.draw_gel),
    "plates": ("plates", molviz.draw_plate),
}


def sha256_of_written(drawing: molviz.Drawing, path: Path) -> str:
    drawing.write(path)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_each_input_and_ending_gets_its_sha256_sorted_by_file(tmp_path) -> None:
    for folder, inputs in INPUTS.items():
        (tmp_path / folder).mkdir()
        for stem, value in inputs.items():
            (tmp_path / folder / f"{stem}.json").write_text(json.dumps(value), encoding="utf-8")
    output = tmp_path / "drawings.sha256"

    subprocess.run([sys.executable, SCRIPT, "--tests", tmp_path, output], check=True)

    expected = [
        f"{sha256_of_written(draw(INPUTS[folder][stem]), tmp_path / f'w{ending}')}"
        f"  {name}/{stem}{ending}"
        for name, stem in [
            ("gels", "a-first"),
            ("plates", "a-first"),
            ("records", "a-first"),
            ("records", "b-second"),
            ("sequence-views", "a-first"),
            ("sequence-views", "b-second"),
        ]
        for folder, draw in [DRAW[name]]
        for ending in (".html", ".pdf", ".png", ".svg")
    ]
    assert output.read_text(encoding="utf-8").splitlines() == expected
