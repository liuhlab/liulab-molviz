# Test gels

Each file here is one gel in the viewer's gel format. A test in `pixi run check` passes every
file through the viewer's gel check.

They are mbio's example gels, with two keys renamed: `bands_bp` to `bands`, and a lane's
`label` to `name`. Each file is named by its example, then by the gel's title.

| Example | Made from mbio's | What its gels cover |
| --- | --- | --- |
| `ap1` | `docs/examples/ap1-library/protocol/project.json` | Two gels from a project, one lane each. |
| `gateway` | `docs/examples/gateway/protocol.json` | A colony PCR. |
| `gibson` | `docs/examples/pUC19-GFP/gibson/protocol.json` | PCR products on the 1 kb Plus ladder, and a lane with two bands. |
| `golden-gate` | `docs/examples/pUC19-GFP/protocol.json` | The same two gels, for the Golden Gate build. |
| `restriction` | `docs/examples/pUC19-GFP/restriction/protocol.json` | Four gels. Two are digests with a 2 bp band, far below the ladder's smallest. |
| `pcr-test` | `tests/data/pcr-protocol.json` | The only lane with no band, and the only ladder listed largest first. |

`scripts/write_test_records.py` writes these files along with the test records. To run it, see
[the test records' README](../records/README.md).
