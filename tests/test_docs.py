from pathlib import Path

ROOT = Path(__file__).parents[1]


def test_the_line_map_page_draws_every_test_record() -> None:
    page = (ROOT / "docs" / "line-map.md").read_text(encoding="utf-8")
    records = sorted((ROOT / "tests" / "records").glob("*.json"))
    missing = [path.name for path in records if f'"tests/records/{path.name}"' not in page]
    assert records
    assert missing == []
