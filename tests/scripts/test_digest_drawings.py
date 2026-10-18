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


def sha256_of_written(record: dict, path: Path) -> str:
    molviz.draw(record).write(path)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_each_record_and_ending_gets_its_sha256_sorted_by_file(tmp_path) -> None:
    records = tmp_path / "records"
    records.mkdir()
    for stem, record in RECORDS.items():
        (records / f"{stem}.json").write_text(json.dumps(record), encoding="utf-8")
    output = tmp_path / "drawings.sha256"

    subprocess.run([sys.executable, SCRIPT, records, output], check=True)

    expected = [
        f"{sha256_of_written(RECORDS[stem], tmp_path / f'{stem}{ending}')}  {stem}{ending}"
        for stem in ("a-first", "b-second")
        for ending in (".html", ".pdf", ".png", ".svg")
    ]
    assert output.read_text(encoding="utf-8").splitlines() == expected
