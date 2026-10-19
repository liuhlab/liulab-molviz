import json
from typing import Any

import pytest
from py_mini_racer import JSEvalException, MiniRacer

from molviz import viewer_script
from molviz.viewer import outlines_script


def run(expression: str) -> Any:
    with MiniRacer() as ctx:
        ctx.eval(viewer_script())
        return ctx.eval(expression)


def test_the_viewer_script_defines_the_molviz_global() -> None:
    assert run("typeof molviz") == "object"


def test_the_viewer_script_can_be_inlined_in_a_script_element() -> None:
    # The HTML parser ends a script at `</script` in any case, and reads `<!--` in one apart.
    script = viewer_script().lower()
    assert "</script" not in script
    assert "<!--" not in script


def test_the_viewer_script_opens_with_the_licence_of_what_it_bundles() -> None:
    banner = viewer_script().split("*/", 1)[0]
    # DejaVu and valibot, by their copyright lines.
    for holder in ["Bitstream Vera Fonts Copyright", "Fabian Hiller"]:
        assert holder in banner


def test_the_viewer_script_carries_no_font_parser() -> None:
    # opentype.js, by the name its licence is listed under and an error it throws.
    script = viewer_script()
    for marker in ["opentype.js", "Unsupported OpenType signature"]:
        assert marker not in script


def test_the_viewer_alone_refuses_to_write_a_file_naming_the_outline_script() -> None:
    record = {"name": "pUC19", "circular": True, "bases": "GATC"}
    with pytest.raises(JSEvalException, match="a file's outlines need the outline script"):
        run(f"molviz.svg({json.dumps(record)})")


def test_the_outline_script_opens_with_the_licence_of_the_fonts() -> None:
    banner = outlines_script().split("*/", 1)[0]
    assert banner.startswith("/*!")
    assert "Bitstream Vera Fonts Copyright" in banner
