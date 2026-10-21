"""Print the SHA-256 of every file the test inputs draw to, one line per file.

    pixi run digest-drawings [-- OUTPUT]

Each input in a folder of `DRAWS` under ``--tests`` is drawn by each call of `DRAWS` for that
folder, a figure with its own options, and written as ``.html``, ``.svg``, ``.png`` at the
default dpi, and ``.pdf``; its still SVG is digested as ``.still.svg``. Each line is
``<sha256>  <name>/<input>.<ending>``, sorted by file, the form ``sha256sum`` writes.
CI writes this on each platform and compares the two, so the same input writing the same bytes
is checked without a stored digest to keep up to date.
"""

import argparse
import hashlib
import json
import tempfile
from collections.abc import Callable
from pathlib import Path
from typing import Any

import molviz

ENDINGS = (".html", ".svg", ".png", ".pdf")


def _read(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _figure(path: Path) -> molviz.Drawing:
    """Draw the figure at ``path``, its records read from the ``records`` folder beside its own."""
    figure = _read(path)
    records = [_read(path.parents[1] / "records" / f"{stem}.json") for stem in figure["records"]]
    return molviz.draw_figure(records, **figure["options"])


#: Each set of drawings by its name: the folder of test inputs it draws, one per ``.json``
#: file, and the call that draws one from its path.
DRAWS: dict[str, tuple[str, Callable[[Path], molviz.Drawing]]] = {
    "records": ("records", lambda path: molviz.draw(_read(path))),
    "sequence-views": ("records", lambda path: molviz.draw(_read(path), sequence_view=True)),
    "gels": ("gels", lambda path: molviz.draw_gel(_read(path))),
    "plates": ("plates", lambda path: molviz.draw_plate(_read(path))),
    "figures": ("figures", _figure),
}


def digests(tests: Path) -> list[str]:
    """Return one ``<sha256>  <name>/<file>`` line per drawing and ending, sorted by file.

    ``tests`` holds each folder of `DRAWS`.
    """
    lines: dict[str, str] = {}
    with tempfile.TemporaryDirectory() as scratch:
        for set_name, (folder, draw) in DRAWS.items():
            for path in (tests / folder).glob("*.json"):
                drawing = draw(path)
                for ending in ENDINGS:
                    written = Path(scratch) / f"drawing{ending}"
                    drawing.write(written)
                    name = f"{set_name}/{path.stem}{ending}"
                    lines[name] = f"{hashlib.sha256(written.read_bytes()).hexdigest()}  {name}"
                name = f"{set_name}/{path.stem}.still.svg"
                still = drawing.still_svg().encode()
                lines[name] = f"{hashlib.sha256(still).hexdigest()}  {name}"
    return [lines[name] for name in sorted(lines)]


def main() -> None:
    """Write the lines to OUTPUT, or print them."""
    parser = argparse.ArgumentParser(description="Digest every test input's drawings.")
    folders = ", ".join(dict.fromkeys(folder for folder, _ in DRAWS.values()))
    parser.add_argument(
        "--tests", type=Path, default=Path("tests"), help=f"the folder holding {folders}"
    )
    parser.add_argument("output", type=Path, nargs="?", help="the file to write; else stdout")
    args = parser.parse_args()
    text = "".join(f"{line}\n" for line in digests(args.tests))
    if args.output is None:
        print(text, end="")
    else:
        args.output.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
