"""Draws DNA sequences and plasmids in the browser, from data a caller hands over."""

from importlib.metadata import version

from molviz.drawing import Drawing, check, draw
from molviz.gel import check_gel, draw_gel
from molviz.viewer import viewer_script

#: Read from the installed distribution's metadata, which hatch-vcs fills from the newest
#: git tag. No version string is written by hand anywhere in this repo.
__version__ = version("liulab-molviz")

__all__ = [
    "Drawing",
    "__version__",
    "check",
    "check_gel",
    "draw",
    "draw_gel",
    "viewer_script",
]
