import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[1]


@pytest.mark.parametrize(
    ("page", "folder"),
    [
        ("line-map.md", "records"),
        ("sequence-view.md", "records"),
        ("gels.md", "gels"),
        ("plates.md", "plates"),
    ],
)
def test_a_docs_page_draws_every_test_input_in_its_folder(page, folder) -> None:
    text = (ROOT / "docs" / page).read_text(encoding="utf-8")
    inputs = sorted((ROOT / "tests" / folder).glob("*.json"))
    missing = [path.name for path in inputs if f'"tests/{folder}/{path.name}"' not in text]
    assert inputs
    assert missing == []


def test_the_figures_page_draws_every_test_figure() -> None:
    # A figure file names its records, so its slot inlines each one and writes the options out.
    text = (ROOT / "docs" / "figures.md").read_text(encoding="utf-8")
    slots = [
        {
            "records": re.findall(r'--8<-- "tests/records/(.+?)\.json"', slot),
            "options": json.loads(re.findall(r"data-options>(.*?)</script>", slot, re.DOTALL)[0]),
        }
        for slot in re.findall(r'<div data-molviz="figure">(.*?)</div>', text, re.DOTALL)
    ]
    figures = sorted((ROOT / "tests" / "figures").glob("*.json"))
    missing = [path.name for path in figures if json.loads(path.read_text("utf-8")) not in slots]
    assert figures
    assert missing == []
