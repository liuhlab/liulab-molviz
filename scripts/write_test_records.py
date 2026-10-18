"""Write mbio's example records into ``tests/records/``, in the viewer's format.

It runs in mbio's environment, and ``tests/records/README.md`` has the command. Each input is
read at `REVISION` through ``git show``, so mbio's files on disk do not matter, but the mbio
code it imports must match that commit. Every record carries the cuts of all of mbio's
enzymes. The hand-made records in ``tests/records/`` are not written here.
"""

import inspect
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import mbio  # pyright: ignore[reportMissingImports]
from mbio.enzymes import enzymes  # pyright: ignore[reportMissingImports]
from mbio.io import read_record  # pyright: ignore[reportMissingImports]
from mbio.plot.layers import items, translation  # pyright: ignore[reportMissingImports]
from mbio.sites import find_sites  # pyright: ignore[reportMissingImports]

#: The mbio commit the records are read at. To move it, edit it and run this again.
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


def _span(span: Any) -> dict[str, Any]:
    return {"start": int(span.start), "end": int(span.end)}


def _codon_start(feature: Any) -> int:
    """Return the base, 1 to 3, a CDS is read from: 1 when `/codon_start` is missing or invalid."""
    try:
        start = int(feature.qualifiers.get("codon_start", (1,))[0])
    except (IndexError, ValueError):
        return 1
    return start if start in (1, 2, 3) else 1


def _feature(feature: Any, record: Any) -> dict[str, Any]:
    own = _color(feature.color)
    segments = []
    for segment in feature.segments:
        written = _span(segment)
        if (color := _color(segment.color)) and color != own:
            written["color"] = color
        segments.append(written)
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
    out = [{"name": p.name, "bases": p.sequence, "sites": []} for p in record.primers]
    sites = [(i, site) for i, primer in enumerate(record.primers) for site in primer.binding_sites]
    # `items` gives one primer item per site, in the order the record lists them.
    primer_items = items(record, features=False, cut_sites=False)
    for (i, site), item in zip(sites, primer_items, strict=True):
        written = _span(site) | {"strand": int(site.strand)}
        if item.mismatches:
            written["mismatches"] = list(item.mismatches)
        out[i]["sites"].append(written)
    return out


def _cuts(record: Any) -> list[dict[str, Any]]:
    # A site whose cut falls off a linear record cuts nothing, and mbio's map drops it.
    return [
        {
            "enzyme": site.enzyme.name,
            **_span(site),
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


def _git(repo: Path, *args: str) -> bytes:
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True).stdout


def main() -> None:
    """Write each record in `RECORDS` from mbio at `REVISION`."""
    imported = Path(inspect.getfile(mbio)).resolve().parent
    repo = Path(_git(imported, "rev-parse", "--show-toplevel").decode().strip())
    changed = _git(repo, "diff", "--name-only", REVISION, "--", "src")
    changed += _git(repo, "status", "--porcelain", "--untracked-files=all", "--", "src")
    if changed:
        sys.exit(f"the mbio imported from {repo} differs from {REVISION} in src/")
    out = Path(__file__).resolve().parents[1] / "tests" / "records"
    with tempfile.TemporaryDirectory() as scratch:
        for name, path in RECORDS.items():
            input_file = Path(scratch) / Path(path).name
            input_file.write_bytes(_git(repo, "show", f"{REVISION}:{path}"))
            data = convert(read_record(input_file))
            text = json.dumps(data, indent=1, ensure_ascii=False) + "\n"
            (out / f"{name}.json").write_text(text, encoding="utf-8")
            counts = ", ".join(f"{len(v)} {k}" for k, v in data.items() if isinstance(v, list))
            print(f"{name}: {len(data['bases'])} bp, {counts}")
    print(f"from mbio {REVISION}, at {repo}")


if __name__ == "__main__":
    main()
