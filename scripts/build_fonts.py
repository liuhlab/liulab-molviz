"""Rebuild the viewer's font subsets from conda-forge's DejaVu faces.

    pixi run build-fonts

The subsets keep the ``kern`` feature and no other layout feature, because opentype.js cannot
read the rest of DejaVu's layout tables. Each subset keeps the face's name table, licence
included. The same inputs write the same bytes.
"""

import sys
from pathlib import Path

# Only the `fonts` environment has fontTools; pyright runs in `default`.
from fontTools import subset  # pyright: ignore[reportMissingImports]

FACES = {"DejaVuSans.ttf": "sans.ttf", "DejaVuSans-Bold.ttf": "sans-bold.ttf"}

# Latin, Greek letters, general punctuation, arrows, the trade mark and the minus sign, and
# U+FFFD, which the viewer draws for any character a face lacks.
UNICODES = [
    *range(0x20, 0x7F),
    *range(0xA0, 0x180),
    *range(0x391, 0x3AA),
    *range(0x3B1, 0x3CA),
    *range(0x2010, 0x2028),
    *range(0x2030, 0x203B),
    *range(0x2190, 0x219A),
    0x2122,
    0x2212,
    0xFFFD,
]


def main() -> None:
    """Write each subset into ``src/viewer/fonts/``, replacing what is there."""
    source = Path(sys.prefix) / "fonts"
    target = Path(__file__).resolve().parents[1] / "src" / "viewer" / "fonts"
    options = subset.Options(layout_features=["kern"], hinting=False, name_IDs=["*"])
    options.drop_tables += ["FFTM", "MATH"]
    for name, out in FACES.items():
        font = subset.load_font(source / name, options)
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=UNICODES)
        subsetter.subset(font)
        subset.save_font(font, target / out, options)


if __name__ == "__main__":
    main()
