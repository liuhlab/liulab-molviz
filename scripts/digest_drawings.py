"""Print the SHA-256 of every file the test records draw to, one line per file.

    pixi run digest-drawings [-- OUTPUT]

Each record in RECORDS is drawn with its default options and written as ``.html``, ``.svg``,
``.png`` at the default dpi, and ``.pdf``. Each line is ``<sha256>  <record>.<ending>``, sorted by file,
the form ``sha256sum`` writes. CI writes this on each platform and compares the two, so the
same input writing the same bytes is checked without a stored digest to keep up to date.
"""

import argparse
import hashlib
import json
import tempfile
from pathlib import Path

import molviz

ENDINGS = (".html", ".svg", ".png", ".pdf")


def digests(records: Path) -> list[str]:
    """Return one ``<sha256>  <file>`` line per record and ending, sorted by file."""
    lines: dict[str, str] = {}
    with tempfile.TemporaryDirectory() as scratch:
        for path in records.glob("*.json"):
            drawing = molviz.draw(json.loads(path.read_text(encoding="utf-8")))
            for ending in ENDINGS:
                name = path.stem + ending
                drawing.write(Path(scratch) / name)
                digest = hashlib.sha256((Path(scratch) / name).read_bytes()).hexdigest()
                lines[name] = f"{digest}  {name}"
    return [lines[name] for name in sorted(lines)]


def main() -> None:
    """Write the lines to OUTPUT, or print them."""
    parser = argparse.ArgumentParser(description="Digest every record's drawings.")
    parser.add_argument("records", type=Path, help="a folder of records, one per .json file")
    parser.add_argument("output", type=Path, nargs="?", help="the file to write; else stdout")
    args = parser.parse_args()
    text = "".join(f"{line}\n" for line in digests(args.records))
    if args.output is None:
        print(text, end="")
    else:
        args.output.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
