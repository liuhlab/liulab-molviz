"""Write mbio's example inputs into ``tests/``, in the viewer's formats, by mbio's converter.

The records go to ``tests/records/``, and from mbio's protocol JSON the figures to
``tests/figures/``, the gels to ``tests/gels/`` and the plates to ``tests/plates/``. It runs in
mbio's environment, and ``tests/records/README.md`` has the command. Each input is read at
`REVISION` through ``git show``, so mbio's files on disk do not matter, but the mbio code it
imports must match that commit. Every record carries the cuts of all of mbio's enzymes. An
input that repeats one already written, such as a plate two protocols declare alike, is written
once. The hand-made records in ``tests/records/`` are not written here.
"""

import dataclasses
import inspect
import json
import posixpath
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import mbio  # pyright: ignore[reportMissingImports]
from mbio.io import read_record  # pyright: ignore[reportMissingImports]
from mbio.plot.converter import molviz_record  # pyright: ignore[reportMissingImports]
from mbio.protocol.converter import (  # pyright: ignore[reportMissingImports]
    molviz_figure,
    molviz_gel,
    molviz_plate,
    molviz_stamp,
)
from mbio.protocol.model import (  # pyright: ignore[reportMissingImports]
    read_project,
    read_protocol,
)
from mbio.sequence import (  # pyright: ignore[reportMissingImports]
    Feature,
    Segment,
    SequenceRecord,
    reverse_complement,
)
from mbio.verification import (  # pyright: ignore[reportMissingImports]
    read_channels,
    read_trace,
    regions,
    verify,
)
from mbio.verification.cli import read_result  # pyright: ignore[reportMissingImports]
from mbio.verification.converter import (  # pyright: ignore[reportMissingImports]
    molviz_verification,
)

#: The mbio commit the records are read at. To move it, edit it and run this again.
REVISION = "055ff01a4fc26b11d4527850e08671c508420551"

#: Each record's file name in ``tests/records/``, and its input in mbio.
RECORDS = {
    "puc19-gfp-product": "docs/examples/pUC19-GFP/product.dna",
    "puc19-backbone-amplicon": "docs/examples/pUC19-GFP/puc19-backbone-amplicon.dna",
    "gfp-amplicon": "docs/examples/pUC19-GFP/gfp-amplicon.dna",
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
    "puc19-gfp-assembly": ("docs/examples/pUC19-GFP/protocol.json", "run-assembly"),
}

#: Each verification's file name in ``tests/records/``: its record in mbio, and the results
#: held against it in the record's own regions.
VERIFICATIONS = {
    "puc19-gfp-verification": (
        "docs/examples/pUC19-GFP/product.dna",
        ("docs/examples/pUC19-GFP/verification/consensus.fasta",),
    ),
}

#: Each trace record's file name in ``tests/records/``: its Sanger trace in mbio, and whether the
#: record is read along its bottom strand.
TRACES = {
    "trace-3730": ("tests/data/3730.ab1", False),
    "trace-3730-reversed": ("tests/data/3730.ab1", True),
}

#: Where a trace record's one changed base is, counted into the trace's trusted bases, as mbio's
#: page tests plant it; and how many bases the record keeps on each side of it.
PLANTED = 300
FLANK = 60

#: The base planted in place of each base.
_REPLACEMENT = {"A": "C", "C": "G", "G": "T", "T": "A"}

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


def _trace(name: str, path: Path, reverse: bool) -> dict[str, Any]:
    """Return a record of a trace's trusted bases, `PLANTED` changed, cropped to `FLANK` each side.

    The record is verified whole against the trace, as mbio's page tests do, then cropped. Read
    along the bottom strand, it is the reverse complement, cropped to the same bases.
    """
    result, channels = read_trace(path), read_channels(path)
    first, last = result.trusted_span
    bases = list(result.bases[first:last])
    bases[PLANTED] = _REPLACEMENT[bases[PLANTED]]
    own = "".join(bases)
    start, end = PLANTED - FLANK, PLANTED + FLANK
    if reverse:
        own = reverse_complement(own)
        start, end = len(own) - end, len(own) - start
    record = SequenceRecord(own, name=name)
    whole = Feature("read", "misc_feature", (Segment(0, len(own)),))
    made = verify(record, (result,), (whole,))
    [track] = molviz_verification(record, (result,), made, channels=(channels,))["tracks"]
    window = SequenceRecord(own[start:end], name=name)
    return (
        molviz_record(window)
        | molviz_verification(window, (result,), _cropped(made, start, end))
        | {"tracks": [_cropped_track(track, start, end)]}
    )


def _cropped(made: Any, start: int, end: int) -> Any:
    """Return a verification within the bases from `start` to `end`, counted from `start`.

    Each placement is clipped to them, and a disagreement not wholly within them is dropped.
    """
    placements = tuple(
        dataclasses.replace(
            placed,
            span=Segment(max(placed.span.start, start) - start, min(placed.span.end, end) - start),
        )
        if placed.span is not None
        else placed
        for placed in made.placements
    )
    disagreements = tuple(
        dataclasses.replace(one, start=one.start - start, end=one.end - start)
        for one in made.disagreements
        if start <= one.start and one.end <= end
    )
    return dataclasses.replace(made, placements=placements, disagreements=disagreements)


def _cropped_track(track: dict[str, Any], start: int, end: int) -> dict[str, Any]:
    """Return a track's peaks over the bases from `start` to `end`, counted from `start`.

    The curves keep the samples from a step before the first of those peaks to a step after the
    last, more than a run of them draws.
    """
    peaks = [(sample, base - start) for sample, base in track["peaks"] if start <= base < end]
    (first, _), (second, _) = peaks[:2]
    (before, _), (final, _) = peaks[-2:]
    low = max(0, 2 * first - second)
    high = 2 * final - before + 1
    curves = {base: values[low:high] for base, values in track["curves"].items()}
    moved = [[sample - low, base] for sample, base in peaks]
    return track | {"curves": curves, "peaks": moved}


def convert_figure(figure: Any, folder: str, repo: Path, scratch: Path) -> dict[str, Any]:
    """Return a figure from mbio's protocol JSON as its records' names and its options.

    Each record path resolves against `folder`, the protocol's folder in mbio, to a name in
    `RECORDS`; any other record stops the script. The options are mbio's converter's, and the
    caption and citation stay mbio's.
    """
    names = {path: name for name, path in RECORDS.items()}
    records = []
    for path in figure.records:
        if (resolved := posixpath.normpath(posixpath.join(folder, path))) not in names:
            sys.exit(f"a figure draws {resolved}, which is not in RECORDS")
        _show(repo, resolved, scratch)
        records.append(names[resolved])
    return {"records": records, "options": molviz_figure(figure, scratch / folder)["options"]}


def _figure(protocols: tuple[Any, ...], key: str) -> Any:
    """Return the one figure of the step with ``key`` in `protocols`."""
    steps = [step for protocol in protocols for step in protocol.steps]
    found = [figure for step in steps if step.key == key for figure in step.figures]
    if len(found) != 1:
        sys.exit(f"step {key!r} holds {len(found)} figures, not one")
    return found[0]


def _plates(protocol: Any) -> list[tuple[str, dict[str, Any]]]:
    """Return each plate a protocol declares, then both plates of each stamp, each with a name."""
    out = [(_slug(plate.name), molviz_plate(plate)) for plate in protocol.plates]
    for step in protocol.steps:
        for transfer in step.transfers:
            pair = zip(("from", "into"), molviz_stamp(transfer, protocol.plates), strict=False)
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


def _write(
    path: Path, data: dict[str, Any], written: dict[Path, str], *, compact: bool = False
) -> bool:
    """Write ``data`` to ``path``, unless it repeats a file in ``written`` exactly.

    Returns whether it wrote. Stops where two different inputs would both be written to ``path``.
    A `compact` file is written on one line, with no spaces.
    """
    shape: dict[str, Any] = {"separators": (",", ":")} if compact else {"indent": 1}
    text = json.dumps(data, ensure_ascii=False, **shape) + "\n"
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
    """Return a copy of mbio's file at ``path`` as it was at `REVISION`, at that path in ``scratch``.

    A figure's records are read relative to its protocol, so each copy keeps mbio's folders.
    """
    copy = scratch / path
    copy.parent.mkdir(parents=True, exist_ok=True)
    copy.write_bytes(_git(repo, "show", f"{REVISION}:{path}"))
    return copy


def _print_counts(name: str, record: dict[str, Any]) -> None:
    counts = ", ".join(f"{len(v)} {k}" for k, v in record.items() if isinstance(v, list))
    print(f"{name}: {len(record['bases'])} bp, {counts}")


def main() -> None:
    """Write every input in `RECORDS`, `VERIFICATIONS`, `TRACES`, `FIGURES`, `GELS` and `PLATES`."""
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
            data = molviz_record(read_record(_show(repo, path, scratch)))
            if _write(tests / "records" / f"{name}.json", data, written):
                _print_counts(name, data)
        for name, (path, paths) in VERIFICATIONS.items():
            record = read_record(_show(repo, path, scratch))
            results = tuple(read_result(_show(repo, one, scratch)) for one in paths)
            made = verify(record, results, regions(record))
            data = molviz_record(record) | molviz_verification(record, results, made)
            if _write(tests / "records" / f"{name}.json", data, written):
                _print_counts(name, data)
        for name, (path, reverse) in TRACES.items():
            data = _trace(name, _show(repo, path, scratch), reverse)
            # Its curves' numbers would take a line each.
            if _write(tests / "records" / f"{name}.json", data, written, compact=True):
                _print_counts(name, data)
        for name, (path, key) in FIGURES.items():
            protocols = _protocols(_show(repo, path, scratch))
            figure = convert_figure(_figure(protocols, key), posixpath.dirname(path), repo, scratch)
            if _write(tests / "figures" / f"{name}.json", figure, written):
                print(f"{name}: {', '.join(figure['records'])}")
        for short, path in GELS.items():
            for protocol in _protocols(_show(repo, path, scratch)):
                for gel in (gel for step in protocol.steps for gel in step.gels):
                    name = _slug(f"{short} {gel.title}")
                    if _write(tests / "gels" / f"{name}.json", molviz_gel(gel), written):
                        print(f"{name}: {len(gel.lanes)} lanes")
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
