"""Draws DNA sequences and plasmids in the browser, from data a caller hands over."""

from importlib.metadata import version

from molviz.viewer import viewer_script

#: Read from the installed distribution's metadata, which hatch-vcs fills from the newest
#: git tag. No version string is written by hand anywhere in this repo.
__version__ = version("liulab-molviz")

__all__ = ["__version__", "viewer_script"]
