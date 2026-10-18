"""Write mbio's example records, gels and plates into ``tests/``, in the viewer's formats.

The records go to ``tests/records/``, and from mbio's protocol JSON the gels to ``tests/gels/``
and the plates to ``tests/plates/``. It runs in mbio's environment, and
``tests/records/README.md`` has the command. Each input is read at `REVISION` through
``git show``, so mbio's files on disk do not matter, but the mbio code it imports must match
that commit. Every record carries the cuts of all of mbio's enzymes. The hand-made records in
``tests/records/`` are not written here.
"""

import inspect
import json
import re
import subprocess
import sys
import tempfile
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import mbio  # pyright: ignore[reportMissingImports]
from mbio.enzymes import enzymes  # pyright: ignore[reportMissingImports]
from mbio.io import read_record  # pyright: ignore[reportMissingImports]
from mbio.plot.layers import items, translation  # pyright: ignore[reportMissingImports]
from mbio.protocol.model import (  # pyright: ignore[reportMissingImports]
    read_project,
    read_protocol,
)
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

#: Each protocol or project in mbio that declares plates, by the short name that starts each
#: plate's file name in ``tests/plates/``. The plate's name, or a stamp's title, ends it.
PLATES = {
    "ap1": "docs/examples/ap1-library/protocol/project.json",
    "ap1-readback": "docs/examples/ap1-readback/protocol.json",
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


def convert_plate(
    plate: Any, title: str | None = None, wells: Mapping[str, str] | None = None
) -> dict[str, Any]:
    """Return an mbio ``Plate`` in the viewer's format, its wells in reading order.

    The format becomes rows and columns. The title is the plate's name and the wells are
    ``{**labels, **seating}``, as mbio's page draws them, unless `title` or `wells` is given.
    A plate with no well filled has no ``wells``.
    """
    held = {**plate.labels, **plate.seating} if wells is None else wells
    out: dict[str, Any] = {
        "title": plate.name if title is None else title,
        "rows": plate.rows,
        "columns": plate.columns,
    }
    if held:
        order = {name: i for i, name in enumerate(plate.well_names)}
        out["wells"] = {name: held[name] for name in sorted(held, key=order.__getitem__)}
    return out


def _stamped(transfer: Any, plates: tuple[Any, ...]) -> list[dict[str, Any]]:
    """Return the "From" and "Into" plates mbio's page draws for a transfer, or none.

    mbio draws a transfer only where it is a stamp, both its plates are declared in `plates`,
    and every well it touches is on its plate. Each touched well holds the transfer's title.
    """
    declared = {plate.name: plate for plate in plates}
    source = declared.get(transfer.plates[0])
    destination = declared.get(transfer.plates[-1])
    if transfer.stamp is None or source is None or destination is None:
        return []
    title: str = transfer.title
    taken: set[str] = {move.source.well for move in transfer.moves}
    filled: set[str] = {move.destination.well for move in transfer.moves}
    if not (taken <= set(source.well_names) and filled <= set(destination.well_names)):
        return []
    return [
        convert_plate(source, f"From {source.name}", dict.fromkeys(taken, title)),
        convert_plate(destination, f"Into {destination.name}", dict.fromkeys(filled, title)),
    ]


def _plates(protocol: Any) -> list[tuple[str, dict[str, Any]]]:
    """Return each plate a protocol declares, then both plates of each stamp, each with a name."""
    out = [(_slug(plate.name), convert_plate(plate)) for plate in protocol.plates]
    for step in protocol.steps:
        for transfer in step.transfers:
            pair = zip(("from", "into"), _stamped(transfer, protocol.plates), strict=False)
            out += [(_slug(f"{transfer.title} {side}"), plate) for side, plate in pair]
    return out


def _protocols(path: Path) -> tuple[Any, ...]:
    """Return a protocol file's protocol, or each protocol of a project file, as mbio reads it."""
    if "protocols" in json.loads(path.read_text(encoding="utf-8")):
        return read_project(path).protocols
    return (read_protocol(path),)


def _slug(text: str) -> str:
    """Return ``text`` in lower case, with each run of characters other than a-z and 0-9 a dash."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _text(data: dict[str, Any]) -> str:
    return json.dumps(data, indent=1, ensure_ascii=False) + "\n"


def _write(path: Path, data: dict[str, Any]) -> None:
    path.write_text(_text(data), encoding="utf-8")


def _git(repo: Path, *args: str) -> bytes:
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True).stdout


def main() -> None:
    """Write the records in `RECORDS`, and the gels and plates in `GELS` and `PLATES`."""
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
    plates: dict[str, str] = {}
    with tempfile.TemporaryDirectory() as scratch:
        for short, path in PLATES.items():
            input_file = Path(scratch) / Path(path).name
            input_file.write_bytes(_git(repo, "show", f"{REVISION}:{path}"))
            for protocol in _protocols(input_file):
                for slug, plate in _plates(protocol):
                    name, text = f"{short}-{slug}", _text(plate)
                    # A plate two protocols declare alike is written once.
                    if text in plates.values():
                        continue
                    if name in plates:
                        sys.exit(f"two different plates would both be written to {name}.json")
                    plates[name] = text
                    (tests / "plates" / f"{name}.json").write_text(text, encoding="utf-8")
                    wells = len(plate.get("wells", {}))
                    print(f"{name}: {plate['rows']} by {plate['columns']}, {wells} wells filled")
    print(f"from mbio {REVISION}, at {repo}")


if __name__ == "__main__":
    main()
