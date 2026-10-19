"""Write mbio's example inputs into ``tests/``, in the viewer's formats.

The records go to ``tests/records/``, and from mbio's protocol JSON the figures to
``tests/figures/``, the gels to ``tests/gels/`` and the plates to ``tests/plates/``. It runs in
mbio's environment, and ``tests/records/README.md`` has the command. Each input is read at
`REVISION` through ``git show``, so mbio's files on disk do not matter, but the mbio code it
imports must match that commit. Every record carries the cuts of all of mbio's enzymes. An
input that repeats one already written, such as a plate two protocols declare alike, is written
once. The hand-made records in ``tests/records/`` are not written here.
"""

import inspect
import json
import posixpath
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
    "ap1-block-vector-1": "docs/examples/ap1-library/block-vector-1.dna",
    "ap1-round-1": "docs/examples/ap1-library/round-1.dna",
    "ap1-round-2": "docs/examples/ap1-library/round-2.dna",
    "colour-test": "tests/data/colour-test-snapgene.gbk",
    "primer-test": "tests/data/primer-test.dna",
}

_AP1 = "docs/examples/ap1-library/protocol/project.json"

#: Each figure's file name in ``tests/figures/``, and the protocol or project in mbio and the
#: key of the step that holds it. A figure's records must be in `RECORDS`.
FIGURES = {
    "ap1-round-1": (_AP1, "round-1-ligate"),
    "ap1-round-2": (_AP1, "round-2-ligate"),
    "ap1-round-3": (_AP1, "round-3-ligate"),
    "ap1-barcode": (_AP1, "barcode-wells"),
    "ap1-stuffer": (_AP1, "assemble-cargo"),
    "ap1-cargo": (_AP1, "assemble-into-working-vector"),
}

#: Each protocol or project in mbio whose steps hold gels, by the short name that starts each
#: gel's file name in ``tests/gels/``. The gel's title ends it.
GELS = {
    "ap1": _AP1,
    "gateway": "docs/examples/gateway/protocol.json",
    "gibson": "docs/examples/pUC19-GFP/gibson/protocol.json",
    "golden-gate": "docs/examples/pUC19-GFP/protocol.json",
    "restriction": "docs/examples/pUC19-GFP/restriction/protocol.json",
    "pcr-test": "tests/data/pcr-protocol.json",
}

#: Each protocol or project in mbio that declares plates, by the short name that starts each
#: plate's file name in ``tests/plates/``. The plate's name, or a stamp's title, ends it.
PLATES = {
    "ap1": _AP1,
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


def convert_figure(figure: dict[str, Any], folder: str) -> dict[str, Any]:
    """Return a figure from mbio's protocol JSON as its records' names and its options.

    Each record path resolves against `folder`, the protocol's folder in mbio, to a name in
    `RECORDS`; any other record stops the script. ``linear`` becomes ``"map": "line"``. An
    option at mbio's default is left out, and the caption and citation stay mbio's.
    """
    names = {path: name for name, path in RECORDS.items()}
    records = []
    for path in figure["records"]:
        if (resolved := posixpath.normpath(posixpath.join(folder, path))) not in names:
            sys.exit(f"a figure draws {resolved}, which is not in RECORDS")
        records.append(names[resolved])
    options: dict[str, Any] = {"map": "line"} if figure.get("linear") else {}
    if (span := figure.get("span")) is not None:
        options["span"] = {"start": span[0], "end": span[1]}
    if figure.get("sequence_view"):
        options["sequence_view"] = True
    if (enzymes := figure.get("enzymes")) is not None:
        options["enzymes"] = enzymes
    if highlight := figure.get("highlight"):
        options["highlight"] = highlight
    return {"records": records, "options": options}


def _figure(data: dict[str, Any], key: str) -> dict[str, Any]:
    """Return the one figure of the step with ``key`` in a protocol, or in a project's protocols."""
    protocols = data.get("protocols", [data])
    steps = [step for protocol in protocols for step in protocol.get("steps", [])]
    found = [
        figure for step in steps if step.get("key") == key for figure in step.get("figures", [])
    ]
    if len(found) != 1:
        sys.exit(f"step {key!r} holds {len(found)} figures, not one")
    return found[0]


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


def _write(path: Path, data: dict[str, Any], written: dict[Path, str]) -> bool:
    """Write ``data`` to ``path``, unless it repeats a file in ``written`` exactly.

    Returns whether it wrote. Stops where two different inputs would both be written to ``path``.
    """
    text = json.dumps(data, indent=1, ensure_ascii=False) + "\n"
    if text in written.values():
        return False
    if path in written:
        sys.exit(f"two different inputs would both be written to {path.parent.name}/{path.name}")
    written[path] = text
    path.write_text(text, encoding="utf-8")
    return True


def _git(repo: Path, *args: str) -> bytes:
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True).stdout


def _show(repo: Path, path: str, scratch: Path) -> Path:
    """Return a copy in ``scratch`` of mbio's file at ``path`` as it was at `REVISION`."""
    copy = scratch / Path(path).name
    copy.write_bytes(_git(repo, "show", f"{REVISION}:{path}"))
    return copy


def main() -> None:
    """Write the records in `RECORDS`, and the inputs in `FIGURES`, `GELS` and `PLATES`."""
    imported = Path(inspect.getfile(mbio)).resolve().parent
    repo = Path(_git(imported, "rev-parse", "--show-toplevel").decode().strip())
    changed = _git(repo, "diff", "--name-only", REVISION, "--", "src")
    changed += _git(repo, "status", "--porcelain", "--untracked-files=all", "--", "src")
    if changed:
        sys.exit(f"the mbio imported from {repo} differs from {REVISION} in src/")
    tests = Path(__file__).resolve().parents[1] / "tests"
    written: dict[Path, str] = {}
    with tempfile.TemporaryDirectory() as temporary:
        scratch = Path(temporary)
        for name, path in RECORDS.items():
            data = convert(read_record(_show(repo, path, scratch)))
            if _write(tests / "records" / f"{name}.json", data, written):
                counts = ", ".join(f"{len(v)} {k}" for k, v in data.items() if isinstance(v, list))
                print(f"{name}: {len(data['bases'])} bp, {counts}")
        for name, (path, key) in FIGURES.items():
            protocol = json.loads(_show(repo, path, scratch).read_text(encoding="utf-8"))
            figure = convert_figure(_figure(protocol, key), posixpath.dirname(path))
            if _write(tests / "figures" / f"{name}.json", figure, written):
                print(f"{name}: {', '.join(figure['records'])}")
        for short, path in GELS.items():
            protocol = json.loads(_show(repo, path, scratch).read_text(encoding="utf-8"))
            for gel in _gels(protocol):
                name = _slug(f"{short} {gel.get('title', '')}")
                if _write(tests / "gels" / f"{name}.json", convert_gel(gel), written):
                    print(f"{name}: {len(gel['lanes'])} lanes")
        for short, path in PLATES.items():
            for protocol in _protocols(_show(repo, path, scratch)):
                for slug, plate in _plates(protocol):
                    name = f"{short}-{slug}"
                    if _write(tests / "plates" / f"{name}.json", plate, written):
                        wells = len(plate.get("wells", {}))
                        print(
                            f"{name}: {plate['rows']} by {plate['columns']}, {wells} wells filled"
                        )
    print(f"from mbio {REVISION}, at {repo}")


if __name__ == "__main__":
    main()
