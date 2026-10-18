from typing import Any

from py_mini_racer import MiniRacer

from molviz import viewer_script


def run(expression: str) -> Any:
    with MiniRacer() as ctx:
        ctx.eval(viewer_script())
        return ctx.eval(expression)


def test_the_viewer_script_defines_the_molviz_global() -> None:
    assert run("typeof molviz") == "object"


def test_the_viewer_script_opens_with_the_licence_of_what_it_bundles() -> None:
    banner = viewer_script().split("*/", 1)[0]
    # DejaVu, opentype.js and valibot, by their copyright lines.
    for holder in ["Bitstream Vera Fonts Copyright", "Frederik De Bleser", "Fabian Hiller"]:
        assert holder in banner


def test_the_viewer_measures_text_with_no_browser() -> None:
    # The width Vitest pins for the same call.
    assert run('molviz.measure("AVATo", "sans", 12)') == 34.79296875
