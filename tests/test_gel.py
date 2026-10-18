import re

import pytest

import molviz

GOOD = {
    "title": "PCR products",
    "ladder": {"name": "NEB 100 bp DNA Ladder (N3231)", "bands": [100, 200, 300]},
    "lanes": [{"name": "GFP", "bands": [741]}, {"name": "empty vector", "bands": []}],
}


def test_a_good_gel_passes() -> None:
    molviz.check_gel(GOOD)


def test_a_bad_gel_raises_the_viewers_message() -> None:
    message = "ladder.bands: must hold at least one band\nlanes[0].label: unknown key"
    with pytest.raises(ValueError, match=f"^{re.escape(message)}$"):
        molviz.check_gel(
            {
                **GOOD,
                "ladder": {"name": "none", "bands": []},
                "lanes": [{**GOOD["lanes"][0], "label": "GFP"}],
            }
        )
