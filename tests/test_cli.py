from typer.testing import CliRunner

from molviz import __version__
from molviz.cli import app


def test_version_comes_from_the_installed_metadata() -> None:
    # hatch-vcs derives it from git, so the value moves. That it exists is the claim.
    assert __version__


def test_the_version_verb_prints_the_version() -> None:
    result = CliRunner().invoke(app, ["version"])
    assert result.exit_code == 0
    assert result.output.strip() == __version__
