import json
import re
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
        ("sequence-view.md", "records", every),
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
