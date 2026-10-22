# Check a clone against its reads

When you sequence a clone, you compare its reads with the record you expect. molviz draws the
result: where each read lies, each place where a read disagrees with the record, and a close-up
of the bases round each one, with the read's trace when you have it. Your code aligns the reads
and finds the disagreements. molviz draws only what you hand it.

The examples check pUC19-GFP, the pUC19 vector with GFP put in by Golden Gate assembly, against
one consensus read. The records are in the repo's
[test records](https://github.com/liuhlab/liulab-molviz/tree/main/tests/records). Each step
shows its code, then the drawing that code makes, drawn here from the same record and options.

## Add the reads and the disagreements

A read names the span of the record that it covers, and the strand it was read from. A
disagreement names a place where reads differ from the record, the bases they hold there, and
the reads that show it. This code adds one read that covers the whole plasmid, and its two
disagreements:

```python
import json
from pathlib import Path

import molviz

record = json.loads(Path("puc19-gfp-product.json").read_text())
record["reads"] = [{"name": "consensus.fasta", "start": 0, "end": 3347, "strand": 1}]
record["disagreements"] = [
    {
        "name": "696 A>G",
        "start": 695,
        "end": 696,
        "bases": "G",
        "reads": ["consensus.fasta"],
        "color": "#cc3311",
    },
    {
        "name": "2687 C>T",
        "start": 2686,
        "end": 2687,
        "bases": "T",
        "reads": ["consensus.fasta"],
        "color": "#bbbbbb",
    },
]
molviz.check(record)
```

Give a disagreement its place in one of two ways:

- A substitution or a deletion covers bases of the record, so give it a `start` and an `end`.
  For a deletion, set `bases` to `""`.
- An insertion lies between two bases, so give it `at`, the count of bases before it, and the
  bases the reads add.

The name and the colour are yours. molviz writes the name as you give it, so `696 A>G` counts
from 1, as a reader does. Here red marks a change in a region that fails, and grey marks one
outside every region checked. A disagreement with no colour is grey.

`molviz.check` raises `ValueError` if the record breaks the format, such as a disagreement that
names a read the record doesn't hold. [The record format](../reference/record.md#reads) lists
every key of a read and a disagreement.

## Draw the map

Draw the record with its cut sites left out, and light the read and both disagreements:

```python
lit = ["696 A>G", "2687 C>T", "consensus.fasta"]
molviz.draw(record, kinds_off=["cuts"], highlight=lit).write("verification.html")
```

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-verification.json"
</script>
<script type="application/json" data-options>
{"kinds_off": ["cuts"], "highlight": ["696 A>G", "2687 C>T", "consensus.fasta"]}
</script>
</div>

The read is the ring just outside the backbone. Each disagreement is a bar among the features,
in its own colour.

## Draw a close-up of each disagreement

A close-up is the record drawn over a few dozen bases round one disagreement: the line, and the
sequence view in one row. To make one, draw a span of 30 bases on either side, with a row long
enough to hold the whole span:

```python
for disagreement in record["disagreements"]:
    start = disagreement["start"]
    close_up = molviz.draw(
        record,
        span={"start": start - 30, "end": start + 31},
        sequence_view=True,
        bases_per_row=61,
        kinds_off=["cuts"],
        highlight=[disagreement["name"], *disagreement["reads"]],
    )
    close_up.write(f"close-up-{start + 1}.svg")
```

These are the two close-ups, drawn as still drawings:

<div data-molviz data-still>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-verification.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 665, "end": 726}, "sequence_view": true, "bases_per_row": 61, "kinds_off": ["cuts"], "highlight": ["696 A>G", "consensus.fasta"]}
</script>
</div>

<div data-molviz data-still>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-verification.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 2656, "end": 2717}, "sequence_view": true, "bases_per_row": 61, "kinds_off": ["cuts"], "highlight": ["2687 C>T", "consensus.fasta"]}
</script>
</div>

The read marks the base where it disagrees in red, whatever the colour of the disagreement's
bar. To put a close-up in a page of your own, use `close_up.still_svg()`, which returns the same
drawing as SVG text. [Put drawings in your own page](your-own-page.md) shows how.

## Add a trace

A Sanger read's trace is a track. Your code reads it from the sequencer's `.ab1` file and adds
it to the record's `tracks`. A track holds:

- `name`, the track's name.
- `curves`, four lists of numbers, one for each of `A`, `C`, `G` and `T`, all the same length.
- `peaks`, pairs of a sample and a base, with the base counted from 0. Each pair ties one sample
  of the curves to the base it was read as. The samples rise from one pair to the next.

pUC19-GFP's consensus read has no trace, so this step draws `trace-3730.json`. It holds 120
bases from one Sanger read, with one base changed so that the read disagrees at `61 G>C`:

```python
trace = json.loads(Path("trace-3730.json").read_text())
molviz.draw(
    trace,
    span={"start": 30, "end": 91},
    sequence_view=True,
    bases_per_row=61,
    kinds_off=["cuts"],
    highlight=["61 G>C", "3730"],
).write("close-up-61.svg")
```

<div data-molviz data-still>
<script type="application/json" data-record>
--8<-- "tests/records/trace-3730.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 30, "end": 91}, "sequence_view": true, "bases_per_row": 61, "kinds_off": ["cuts"], "highlight": ["61 G>C", "3730"]}
</script>
</div>

The trace is under the bases: four curves, after the read's name and a key to their colours.
Each peak sits over the base it was read as. Over base 61, the tallest curve is C, where the
record holds G.

If the read is on the bottom strand, swap each curve for the base it pairs with, A with T and
C with G, so that the curves read as the top strand does. The bases in `peaks` then fall as the
samples rise. `trace-3730-reversed.json` is the same read turned to the other strand:

```python
reversed_trace = json.loads(Path("trace-3730-reversed.json").read_text())
molviz.draw(
    reversed_trace,
    span={"start": 29, "end": 90},
    sequence_view=True,
    bases_per_row=61,
    kinds_off=["cuts"],
    highlight=["60 C>G", "3730"],
).write("close-up-60.svg")
```

<div data-molviz data-still>
<script type="application/json" data-record>
--8<-- "tests/records/trace-3730-reversed.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 29, "end": 90}, "sequence_view": true, "bases_per_row": 61, "kinds_off": ["cuts"], "highlight": ["60 C>G", "3730"]}
</script>
</div>

The read now sits under the bases. Over base 60, the tallest curve is G, where the record holds
C.
