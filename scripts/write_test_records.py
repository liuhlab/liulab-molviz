"""Write mbio's example records and gels into ``tests/``, in the viewer's formats.

The records go to ``tests/records/``, and the gels, from mbio's protocol JSON, to
``tests/gels/``. It runs in mbio's environment, and ``tests/records/README.md`` has the
command. Each input is read at `REVISION` through ``git show``, so mbio's files on disk do not
matter, but the mbio code it imports must match that commit. Every record carries the cuts of
all of mbio's enzymes. The hand-made records in ``tests/records/`` are not written here.
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

#: Each protocol or project in mbio whose steps hold gels, by the short name that starts each
#: gel's file name in ``tests/gels/``. The gel's title ends it.
GELS = {
    "ap1": "docs/examples/ap1-library/protocol/project.json",
    "gateway": "docs/examples/gateway/protocol.json",
    "gibson": "docs/examples/pUC19-GFP/gibson/protocol.json",
    "golden-gate": "docs/examples/pUC19-GFP/protocol.json",
    "restriction": "docs/examples/pUC19-GFP/restriction/protocol.json",
    "pcr-test": "tests/data/pcr-protocol.json",
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


def convert_gel(gel: dict[str, Any]) -> dict[str, Any]:
    """Return a gel from mbio's protocol JSON in the viewer's format, leaving out an empty title.

    ``bands_bp`` becomes ``bands``, and a lane's ``label`` becomes its ``name``.
    """
    # A hand-written mbio file may leave out a key that has a default, as mbio's reader allows.
    out: dict[str, Any] = {"title": title} if (title := gel.get("title")) else {}
    out["ladder"] = {"name": gel["ladder"]["name"], "bands": gel["ladder"]["bands_bp"]}
    out["lanes"] = [
        {"name": lane["label"], "bands": lane.get("bands_bp", [])} for lane in gel["lanes"]
    ]
    return out


def _gels(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return every gel of a protocol, or of each protocol in a project, in step order."""
    protocols = data.get("protocols", [data])
    steps = [step for protocol in protocols for step in protocol.get("steps", [])]
    return [gel for step in steps for gel in step.get("gels", [])]


def _slug(text: str) -> str:
    """Return ``text`` in lower case, with each run of characters other than a-z and 0-9 a dash."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _write(path: Path, data: dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def _git(repo: Path, *args: str) -> bytes:
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True).stdout


def main() -> None:
    """Write each record in `RECORDS` and each gel in `GELS` from mbio at `REVISION`."""
    imported = Path(inspect.getfile(mbio)).resolve().parent
    repo = Path(_git(imported, "rev-parse", "--show-toplevel").decode().strip())
    changed = _git(repo, "diff", "--name-only", REVISION, "--", "src")
    changed += _git(repo, "status", "--porcelain", "--untracked-files=all", "--", "src")
    if changed:
        sys.exit(f"the mbio imported from {repo} differs from {REVISION} in src/")
    tests = Path(__file__).resolve().parents[1] / "tests"
    with tempfile.TemporaryDirectory() as scratch:
        for name, path in RECORDS.items():
            input_file = Path(scratch) / Path(path).name
            input_file.write_bytes(_git(repo, "show", f"{REVISION}:{path}"))
            data = convert(read_record(input_file))
            _write(tests / "records" / f"{name}.json", data)
            counts = ", ".join(f"{len(v)} {k}" for k, v in data.items() if isinstance(v, list))
            print(f"{name}: {len(data['bases'])} bp, {counts}")
    written: set[str] = set()
    for short, path in GELS.items():
        for gel in _gels(json.loads(_git(repo, "show", f"{REVISION}:{path}"))):
            name = _slug(f"{short} {gel.get('title', '')}")
            if name in written:
                sys.exit(f"two gels would both be written to {name}.json")
            written.add(name)
            _write(tests / "gels" / f"{name}.json", convert_gel(gel))
            print(f"{name}: {len(gel['lanes'])} lanes")
    print(f"from mbio {REVISION}, at {repo}")


if __name__ == "__main__":
    main()
