# Verification

This page draws a clone checked against its sequencing reads, as mbio's verification page draws
it: the map, then a close-up of each place where a read disagrees with the record. mbio holds
the lab's tools for cloning.

Every drawing here is a still drawing. The viewer draws it once when the page opens, and then it
holds still: it has no zoom and no switches, and resting the pointer on a label shows a plain
tooltip. The page holds the viewer's font rules once, for all its drawings.

The records are the files in `tests/records/` that hold reads. Each also holds its
disagreements, and a Sanger read's trace. Which reads pass, the captions, and where each
close-up starts and ends are the caller's to say. The viewer draws only what it is given.

## Drawing a close-up

A close-up is no new call. It is the record drawn over 30 bases either side of the
disagreement, with the sequence view in one row. The disagreement and every read are lit, and
cut sites are left off. In Python:

```python
import molviz

close_up = molviz.draw(
    record,
    span={"start": 665, "end": 726},
    sequence_view=True,
    bases_per_row=61,
    kinds_off=["cuts"],
    highlight=["696 A>G", "consensus.fasta"],
)
svg = close_up.still_svg()
```

A page that holds still drawings writes `molviz.font_rules()` once, in a `<style>` element.

## puc19-gfp-verification

A Golden Gate product checked against one consensus read, which covers the whole plasmid. The
read is the ring just outside the backbone. It disagrees with the record at two bases, each a
bar among the features. `696 A>G` lies in the GFP insert, a region that fails, so it is red.
`2687 C>T` lies in AmpR, outside every region checked, so it is grey. The map lights the read
and both disagreements.

<div data-molviz data-still>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-verification.json"
</script>
<script type="application/json" data-options>
{"kinds_off": ["cuts"], "highlight": ["696 A>G", "2687 C>T", "consensus.fasta"]}
</script>
</div>

### 696 A>G

A substitution in the GFP insert, which fails, read by consensus.fasta. The read marks the base
where it disagrees in red.

<div data-molviz data-still>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-verification.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 665, "end": 726}, "sequence_view": true, "bases_per_row": 61, "kinds_off": ["cuts"], "highlight": ["696 A>G", "consensus.fasta"]}
</script>
</div>

### 2687 C>T

A substitution in AmpR, outside every region checked, read by consensus.fasta. It has no
verdict, so its bar is grey. The read still marks its base in red.

<div data-molviz data-still>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-verification.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 2656, "end": 2717}, "sequence_view": true, "bases_per_row": 61, "kinds_off": ["cuts"], "highlight": ["2687 C>T", "consensus.fasta"]}
</script>
</div>

## trace-3730

A Sanger read checked against its own bases with one base changed. The record is the 120 bases
around that base. The read covers them all, and its one disagreement, `61 G>C`, is red.

<div data-molviz data-still>
<script type="application/json" data-record>
--8<-- "tests/records/trace-3730.json"
</script>
<script type="application/json" data-options>
{"kinds_off": ["cuts"], "highlight": ["61 G>C", "3730"]}
</script>
</div>

### 61 G>C

Under the bases is the read's trace: four curves, one for each base, after the read's name and
a key of the four colours. Each peak sits over the base it was read as. Over base 61 the tallest
curve is C, where the record holds G.

<div data-molviz data-still>
<script type="application/json" data-record>
--8<-- "tests/records/trace-3730.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 30, "end": 91}, "sequence_view": true, "bases_per_row": 61, "kinds_off": ["cuts"], "highlight": ["61 G>C", "3730"]}
</script>
</div>

## trace-3730-reversed

The same bases turned to the other strand, drawn here as its close-up alone. The read runs along
the bottom strand, so it sits under the bases. Its trace is drawn as the top strand reads it, so
over base 60 the tallest curve is G, where the record holds C.

<div data-molviz data-still>
<script type="application/json" data-record>
--8<-- "tests/records/trace-3730-reversed.json"
</script>
<script type="application/json" data-options>
{"span": {"start": 29, "end": 90}, "sequence_view": true, "bases_per_row": 61, "kinds_off": ["cuts"], "highlight": ["60 C>G", "3730"]}
</script>
</div>
