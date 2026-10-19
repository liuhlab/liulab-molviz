import json
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[1]


def every(_: Path) -> bool:
    return True


def circular(path: Path) -> bool:
    return json.loads(path.read_text(encoding="utf-8"))["circular"]


@pytest.mark.parametrize(
    ("page", "folder", "takes"),
    [
        ("line-map.md", "records", every),
        ("circle.md", "records", circular),
        ("gels.md", "gels", every),
        ("plates.md", "plates", every),
    ],
)
def test_a_docs_page_draws_each_test_input_it_takes_from_its_folder(page, folder, takes) -> None:
    text = (ROOT / "docs" / page).read_text(encoding="utf-8")
    inputs = [path for path in sorted((ROOT / "tests" / folder).glob("*.json")) if takes(path)]
    missing = [path.name for path in inputs if f'"tests/{folder}/{path.name}"' not in text]
    assert inputs
    assert missing == []
