"""Draws DNA sequences and plasmids in the browser, from data a caller hands over."""

from importlib.metadata import version

from molviz.drawing import Drawing, check, draw
from molviz.figure import draw_figure
from molviz.gel import check_gel, draw_gel
from molviz.plate import check_plate, draw_plate
from molviz.viewer import viewer_script

#: Read from the installed distribution's metadata, which hatch-vcs fills from the newest
#: git tag. No version string is written by hand anywhere in this repo.
__version__ = version("liulab-molviz")

__all__ = [
    "Drawing",
    "__version__",
    "check",
    "check_gel",
    "check_plate",
    "draw",
    "draw_figure",
    "draw_gel",
    "draw_plate",
    "viewer_script",
]
