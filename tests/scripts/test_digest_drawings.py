import hashlib
import json
import subprocess
import sys
from pathlib import Path

import molviz

SCRIPT = Path(__file__).parents[2] / "scripts" / "digest_drawings.py"
RECORDS = {
    "b-second": {"name": "pB", "circular": False, "bases": "ACGT" * 25},
    "a-first": {"name": "pA", "circular": True, "bases": "GATC" * 25},
}
GELS = {"a-first": {"ladder": {"name": "ladder", "bands": [100]}, "lanes": []}}


def sha256_of_written(drawing: molviz.Drawing, path: Path) -> str:
    drawing.write(path)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def folder(path: Path, inputs: dict[str, dict]) -> Path:
    path.mkdir()
    for stem, value in inputs.items():
        (path / f"{stem}.json").write_text(json.dumps(value), encoding="utf-8")
    return path


def test_each_record_gel_and_ending_gets_its_sha256_sorted_by_file(tmp_path) -> None:
    records = folder(tmp_path / "some-records", RECORDS)
    gels = folder(tmp_path / "some-gels", GELS)
    output = tmp_path / "drawings.sha256"

    subprocess.run(
        [sys.executable, SCRIPT, "--records", records, "--gels", gels, output], check=True
    )

    endings = (".html", ".pdf", ".png", ".svg")
    expected = [
        f"{sha256_of_written(molviz.draw_gel(GELS[stem]), tmp_path / f'g{ending}')}"
        f"  gels/{stem}{ending}"
        for stem in ("a-first",)
        for ending in endings
    ] + [
        f"{sha256_of_written(molviz.draw(RECORDS[stem]), tmp_path / f'r{ending}')}"
        f"  records/{stem}{ending}"
        for stem in ("a-first", "b-second")
        for ending in endings
    ]
    assert output.read_text(encoding="utf-8").splitlines() == expected
