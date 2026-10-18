from pathlib import Path

import pytest

ROOT = Path(__file__).parents[1]


@pytest.mark.parametrize(("page", "folder"), [("line-map.md", "records"), ("gels.md", "gels")])
def test_a_docs_page_draws_every_test_input_of_its_kind(page, folder) -> None:
    text = (ROOT / "docs" / page).read_text(encoding="utf-8")
    inputs = sorted((ROOT / "tests" / folder).glob("*.json"))
    missing = [path.name for path in inputs if f'"tests/{folder}/{path.name}"' not in text]
    assert inputs
    assert missing == []
