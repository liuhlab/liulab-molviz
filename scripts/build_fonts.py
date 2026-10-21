"""Rebuild the viewer's font subsets from conda-forge's DejaVu faces.

    pixi run build-fonts

Each face is written twice from one subset: as TTF, which the build reads to make the viewer's
tables, and as WOFF2, which pages load. The subsets keep the ``kern`` feature and no other
layout feature, because opentype.js cannot read the rest of DejaVu's layout tables. Each subset
keeps the face's name table, licence included. The same inputs write the same bytes.
"""

import sys
from pathlib import Path
from typing import Any

# Only the `fonts` environment has fontTools; pyright runs in `default`.
from fontTools import subset  # pyright: ignore[reportMissingImports]

FACES = {
    "DejaVuSans.ttf": "sans",
    "DejaVuSans-Bold.ttf": "sans-bold",
    "DejaVuSansMono.ttf": "mono",
}

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

# What Sans Mono draws: bases in either case, amino acids and the stop, and U+FFFD.
BASES = "ACGTURYSWKMBDHVN"
MONO_UNICODES = sorted({ord(c) for c in f"{BASES}{BASES.lower()}ABCDEFGHIJKLMNOPQRSTUVWXYZ*�"})


def subset_options(*, retain_gids: bool = False) -> Any:
    """Return the subsetter's options, keeping each glyph's id if ``retain_gids``."""
    out = subset.Options(layout_features=["kern"], hinting=False, name_IDs=["*"])
    out.drop_tables += ["FFTM", "MATH"]
    out.retain_gids = retain_gids
    return out


def subset_to(font: Any, unicodes: list[int], options: Any) -> None:
    """Keep only ``unicodes`` in ``font``."""
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)


def main() -> None:
    """Write each subset into ``src/viewer/fonts/`` as TTF and WOFF2, replacing what is there."""
    source = Path(sys.prefix) / "fonts"
    target = Path(__file__).resolve().parents[1] / "src" / "viewer" / "fonts"
    for name, face in FACES.items():
        options = subset_options()
        font = subset.load_font(source / name, options)
        subset_to(font, UNICODES, options)
        # Subset again to what it draws, each glyph keeping its id: a file names its glyphs by id.
        if face == "mono":
            subset_to(font, MONO_UNICODES, subset_options(retain_gids=True))
        for flavor, ending in [(None, "ttf"), ("woff2", "woff2")]:
            # `save_font` takes the flavour from the options, not from the font.
            options.flavor = flavor
            subset.save_font(font, target / f"{face}.{ending}", options)


if __name__ == "__main__":
    main()
