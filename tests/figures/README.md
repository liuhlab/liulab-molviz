# Test figures

Each file here is one figure: the records it stacks, top to bottom, and the options every one
of them is drawn with. A record is named by its file name in `tests/records/`, without
`.json`. The options are a record's drawing options. mbio's caption and citation stay in mbio.

| File | Made from | What it covers |
| --- | --- | --- |
| `ap1-round-1.json` | mbio's AP-1 project, step `round-1-ligate` | Two records as lines over one span, `ap1-block-vector-1` above `ap1-round-1`. `N_JUN` is lit, and only the lower record has it, so the upper one is dimmed whole. |
| `ap1-round-2.json` | the same, step `round-2-ligate` | `ap1-round-1` above `ap1-round-2`. `DBD_JUN` is lit, and only the lower record has it. |
| `ap1-round-3.json` | the same, step `round-3-ligate` | `ap1-round-2` above `ap1-product`. `C_JUN` is lit, and only the lower record has it. |
| `ap1-barcode.json` | the same, step `barcode-wells` | One record, `ap1-block-vector-1`, as a line from base 280 to 490, with its `internal stuffer` lit and its unique cutters drawn. |

## Making the figures again

`scripts/write_test_records.py` writes them with the records, from the steps its `FIGURES`
names. `tests/records/README.md` has the command. Each record a figure draws must be in the
script's `RECORDS`, or the script stops.
