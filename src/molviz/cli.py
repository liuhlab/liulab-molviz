"""The command line.

Typer, because every lab repo that ships a command line uses it: one `typer.Typer` named
`app`, and `no_args_is_help=True` so a bare invocation prints help instead of nothing. A larger
surface grows by mounting sub-apps with `app.add_typer`.
"""

import typer

from molviz import __version__ as _package_version

#: What `[project.scripts]` registers. Typer builds the parser from the signatures below, so
#: a verb is a function and its help is the docstring.
app = typer.Typer(help="Draw DNA sequences and plasmids.", no_args_is_help=True)


# With one command and no callback, typer runs that command as the whole app, and
# `molviz version` fails on the extra word.
@app.callback()
def main() -> None:
    """Draw DNA sequences and plasmids."""


@app.command()
def version() -> None:
    """Print the installed package version."""
    typer.echo(_package_version)
