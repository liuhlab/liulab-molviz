"""Draws DNA sequences and plasmids in the browser, from data a caller hands over."""

from importlib.metadata import version

from molviz._runtime import font_rules
from molviz.drawing import SEQUENCE_VIEW_LIMIT, Drawing, check, draw
from molviz.gel import check_gel, draw_gel
from molviz.plate import check_plate, draw_plate
from molviz.viewer import viewer_script

#: Read from the installed distribution's metadata, which hatch-vcs fills from the newest
#: git tag. No version string is written by hand anywhere in this repo.
__version__ = version("liulab-molviz")

__all__ = [
    "SEQUENCE_VIEW_LIMIT",
    "Drawing",
    "__version__",
    "check",
    "check_gel",
    "check_plate",
    "draw",
    "draw_gel",
    "draw_plate",
    "font_rules",
    "viewer_script",
]
