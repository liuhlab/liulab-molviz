# Test plates

Each file here is one plate in the viewer's plate format. A test in `pixi run check` passes every
file through the viewer's plate check.

They are mbio's example plates. A plate's well count becomes its rows and columns, and its
`labels` and `seating` become its `wells`, as mbio's page draws them. A stamp is a transfer
that moves one pattern of wells from one plate into another. Each stamp gives two plates, such
as "From picked 1" and "Into index 1", and each well the stamp touches holds the stamp's title.
A plate that repeats another exactly is written once.

Each file is named by its example, then by the plate's name. A stamp's two plates are named by
the stamp's title, then `from` or `into`.

| Example | Made from mbio's | What its plates cover |
| --- | --- | --- |
| `ap1` | `docs/examples/ap1-library/protocol/project.json` | 96-well plates that hold a different part or primer in each well; a 384-well plate in quarters; a 1,536-well plate with every well empty; and four stamps. |
| `ap1-readback` | `docs/examples/ap1-readback/protocol.json` | A 384-well plate with two quarters filled, a 96-well plate a third full, and one stamp. |

`scripts/write_test_records.py` writes these files along with the test records. To run it, see
[the test records' README](../records/README.md).
