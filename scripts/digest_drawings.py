"""Print the SHA-256 of every file the test inputs draw to, one line per file.

    pixi run digest-drawings [-- OUTPUT]

Each input in a folder named by an option, such as ``--gels``, is drawn by that kind's call with
its defaults and written as ``.html``, ``.svg``, ``.png`` at the default dpi, and ``.pdf``. Each
line is ``<sha256>  <kind>/<input>.<ending>``, sorted by file, the form ``sha256sum`` writes. CI
writes this on each platform and compares the two, so the same input writing the same bytes is
checked without a stored digest to keep up to date.
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

#: Each kind of input, by its option, with the call that draws one.
DRAWS: dict[str, Callable[[dict[str, Any]], molviz.Drawing]] = {
    "records": molviz.draw,
    "gels": molviz.draw_gel,
}


def digests(folders: dict[str, Path]) -> list[str]:
    """Return one ``<sha256>  <kind>/<file>`` line per input and ending, sorted by file.

    ``folders`` holds a folder of inputs, one per ``.json`` file, for each kind in `DRAWS`.
    """
    lines: dict[str, str] = {}
    with tempfile.TemporaryDirectory() as scratch:
        for kind, inputs in folders.items():
            for path in inputs.glob("*.json"):
                drawing = DRAWS[kind](json.loads(path.read_text(encoding="utf-8")))
                for ending in ENDINGS:
                    written = Path(scratch) / f"drawing{ending}"
                    drawing.write(written)
                    name = f"{kind}/{path.stem}{ending}"
                    lines[name] = f"{hashlib.sha256(written.read_bytes()).hexdigest()}  {name}"
    return [lines[name] for name in sorted(lines)]


def main() -> None:
    """Write the lines to OUTPUT, or print them."""
    parser = argparse.ArgumentParser(description="Digest every test input's drawings.")
    for kind in DRAWS:
        parser.add_argument(f"--{kind}", type=Path, help=f"a folder of {kind}, one per .json file")
    parser.add_argument("output", type=Path, nargs="?", help="the file to write; else stdout")
    args = parser.parse_args()
    folders = {kind: getattr(args, kind) for kind in DRAWS if getattr(args, kind)}
    text = "".join(f"{line}\n" for line in digests(folders))
    if args.output is None:
        print(text, end="")
    else:
        args.output.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
