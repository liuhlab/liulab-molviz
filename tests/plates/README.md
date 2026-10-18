# Test plates

Each file here is one plate in the viewer's plate format. A test in `pixi run check` passes every
file through the viewer's plate check, and draws it.

They are mbio's example plates. A plate's well count becomes its rows and columns, and its
`labels` and `seating` become its `wells`, as mbio's page draws them. A stamp is a transfer
that moves one pattern of wells from one plate into another. Each stamp gives two plates, such
as "From picked 1" and "Into index 1", and each well the stamp touches holds the stamp's title.
A plate that repeats another exactly is written once.

Each file is named by its example, then by the plate's name. A stamp's two plates are named by
the stamp's title, then `from` or `into`.

| Example | Made from mbio's | What its plates cover |
| --- | --- | --- |
| `ap1` | `docs/examples/ap1-library/protocol/project.json` | 96-well plates that hold a different part, primer or pair of primers in each well they fill; a 384-well plate in quarters; a 1,536-well plate with every well empty; and four stamps. |
| `ap1-readback` | `docs/examples/ap1-readback/protocol.json` | A 384-well plate with its first quarter full and 32 of the 96 wells in its second quarter filled, a 96-well plate a third full, and two stamps. Its index 1 plate and its stamp into index 1 repeat `ap1`'s exactly, so the script drops them. |

Six more are made by hand:

| File | What it covers |
| --- | --- |
| `ten-contents.json` | Ten different contents, the most that each take a colour of their own and a line of the legend. |
| `eleven-contents.json` | Eleven, so every used well takes one colour and the drawing counts them in place of the legend. |
| `strip.json` | A strip of 8 tubes: one row. |
| `one-well.json` | One well, the narrowest a drawing gets, under a title that wraps. |
| `sparse-1536.json` | A 1,536-well plate, rows A to AF, with a few wells filled. |
| `long-legend.json` | Legend entries too long for one line, one of them a word too long for any line. |

`scripts/write_test_records.py` writes mbio's plates along with the test records, and does not
touch the hand-made ones. To run it, see [the test records' README](../records/README.md).
