# pyright: reportMissingImports=false
r"""Write mbio's example records into ``tests/records/``, in the viewer's format.

It runs in mbio's environment, which ``--as-is`` neither installs into nor changes::

    pixi run --as-is --manifest-path ../liulab-mbio/pyproject.toml python -I \
        scripts/test_records.py --mbio ../liulab-mbio

Each input is read at one mbio commit through ``git show``, so mbio's working tree does not
matter, and mbio's own code must match that commit. Every record carries the cuts of all of
mbio's enzymes. The hand-made records in ``tests/records/`` are not written here.
"""

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from mbio.enzymes import enzymes
from mbio.io import read_record
from mbio.plot.layers import _codon_start, items, translation
from mbio.sites import find_sites

REVISION = "10e87856849e7d484f0274064b8ff96357a5f618"

#: Each record's file name in ``tests/records/``, and its input in mbio.
RECORDS = {
    "puc19-gfp-product": "docs/examples/pUC19-GFP/product.dna",
    "ap1-product": "docs/examples/ap1-library/product.dna",
    "colour-test": "tests/data/colour-test-snapgene.gbk",
    "primer-test": "tests/data/primer-test.dna",
}

_HEX = re.compile(r"#[0-9a-fA-F]{6}")


def _color(value: str | None) -> str | None:
    """Return a file's colour in lower case, or ``None`` for none, SnapGene's ``noColor`` too."""
    return value.lower() if value is not None and _HEX.fullmatch(value) else None


def _feature(feature: Any, record: Any) -> dict[str, Any]:
    own = _color(feature.color)
    segments = []
    for segment in feature.segments:
        one: dict[str, Any] = {"start": int(segment.start), "end": int(segment.end)}
        if (color := _color(segment.color)) and color != own:
            one["color"] = color
        segments.append(one)
    out: dict[str, Any] = {
        "name": feature.name,
        "type": feature.type,
        "strand": int(feature.strand),
        "segments": segments,
    }
    if own:
        out["color"] = own
    # mbio translates a CDS only, and its translation is read from the bases, not the
    # `/translation` qualifier, which goes stale on a joined feature.
    if feature.type == "CDS" and (codons := translation(feature, record)):
        out["translation"] = "".join(codon.amino_acid for codon in codons)
        if (start := _codon_start(feature)) != 1:
            out["codon_start"] = start
    return out


def _primers(record: Any) -> list[dict[str, Any]]:
    # `items` gives one primer item per site, in the order the record lists them.
    drawn = iter(items(record, features=False, cut_sites=False))
    out = []
    for primer in record.primers:
        sites = []
        for site in primer.binding_sites:
            one: dict[str, Any] = {
                "start": int(site.start),
                "end": int(site.end),
                "strand": int(site.strand),
            }
            if mismatches := next(drawn).mismatches:
                one["mismatches"] = list(mismatches)
            sites.append(one)
        out.append({"name": primer.name, "bases": primer.sequence, "sites": sites})
    return out


def _cuts(record: Any) -> list[dict[str, Any]]:
    # A site whose cut falls off a linear record cuts nothing, and mbio's map drops it.
    return [
        {
            "enzyme": site.enzyme.name,
            "start": site.start,
            "end": site.end,
            "at": site.top_cut,
            "stagger": site.enzyme.bottom_cut - site.enzyme.top_cut,
        }
        for site in find_sites(record, enzymes())
        if site.cuts
    ]


def convert(record: Any) -> dict[str, Any]:
    """Return an mbio ``SequenceRecord`` in the viewer's format, leaving out empty lists."""
    out: dict[str, Any] = {
        "name": record.name,
        "circular": record.topology == "circular",
        "bases": record.sequence,
    }
    for key, values in (
        ("features", [_feature(feature, record) for feature in record.features]),
        ("primers", _primers(record)),
        ("cuts", _cuts(record)),
    ):
        if values:
            out[key] = values
    return out


def _git(mbio: Path, *args: str) -> bytes:
    return subprocess.run(["git", "-C", str(mbio), *args], check=True, capture_output=True).stdout


def main() -> None:
    """Write each record in `RECORDS` from mbio at ``--revision``."""
    parser = argparse.ArgumentParser(description="Write mbio's example records for molviz.")
    parser.add_argument("--mbio", type=Path, required=True, help="the mbio checkout")
    parser.add_argument("--revision", default=REVISION, help="the mbio commit to read")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "tests" / "records",
        help="where the records go",
    )
    args = parser.parse_args()
    commit = _git(args.mbio, "rev-parse", f"{args.revision}^{{commit}}").decode().strip()
    changed = subprocess.run(["git", "-C", str(args.mbio), "diff", "--quiet", commit, "--", "src"])
    if changed.returncode:
        sys.exit(f"mbio's src/ differs from {commit}: run on a checkout of that commit")
    args.out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as scratch:
        for name, path in RECORDS.items():
            given = Path(scratch) / Path(path).name
            given.write_bytes(_git(args.mbio, "show", f"{commit}:{path}"))
            data = convert(read_record(given))
            text = json.dumps(data, indent=1, ensure_ascii=False) + "\n"
            (args.out / f"{name}.json").write_text(text, encoding="utf-8")
            counts = ", ".join(f"{len(v)} {k}" for k, v in data.items() if isinstance(v, list))
            print(f"{name}: {len(data['bases'])} bp, {counts}")
    print(f"from mbio {commit}")


if __name__ == "__main__":
    main()
