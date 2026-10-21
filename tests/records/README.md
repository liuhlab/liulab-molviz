# Test records

Each file here is one record in the viewer's format. A test in `pixi run check` passes every
file through the viewer's check, so the records stay valid as the format grows.

## What each record covers

| File | Made from | What it covers |
| --- | --- | --- |
| `puc19-gfp-product.json` | mbio's `docs/examples/pUC19-GFP/product.dna` | A Golden Gate product. Its `lacZα` CDS is joined across the GFP insert. Some of its primers have 5' tails, and its BsmBI and Esp3I sites run across the origin. |
| `puc19-gfp-verification.json` | mbio's `docs/examples/pUC19-GFP/product.dna`, verified against its `verification/consensus.fasta` | `puc19-gfp-product` checked against one consensus read, which covers the whole record. Its two disagreements are coloured as mbio's verification page colours them: `696 A>G` red, in a region that fails, and `2687 C>T` grey, outside every region. |
| `puc19-backbone-amplicon.json` | mbio's `docs/examples/pUC19-GFP/puc19-backbone-amplicon.dna` | A linear PCR product that starts inside `lacZα`, a CDS on the reverse strand. `lacZα` runs off the record's end and on from its start, so its second segment starts lower than its first. Its two primers, one at each end, have 5' tails. |
| `gfp-amplicon.json` | mbio's `docs/examples/pUC19-GFP/gfp-amplicon.dna` | A linear PCR product of GFP. Its forward `GFP` CDS ends at a Golden Gate overhang, and its two primers have 5' tails. |
| `ap1-product.json` | mbio's `docs/examples/ap1-library/product.dna` | A larger product with many features, some on no strand. Its `rop` and `lacI` start with GTG, so their translations start with V. |
| `ap1-block-vector-1.json` | mbio's `docs/examples/ap1-library/block-vector-1.dna` | AP-1's vector before any part goes in, with its `internal stuffer` where the first part goes. |
| `ap1-round-1.json` | mbio's `docs/examples/ap1-library/round-1.dna` | AP-1 after round 1, with `N_JUN` and its barcode in place of the stuffer. |
| `ap1-round-2.json` | mbio's `docs/examples/ap1-library/round-2.dna` | AP-1 after round 2, with `DBD_JUN` joined after `N_JUN`. Round 3 makes `ap1-product`. |
| `colour-test.json` | mbio's `tests/data/colour-test-snapgene.gbk` | Joined, white and grey features. The `split` CDS joins three segments, each later segment with its own colour. The `across` feature runs over the origin. The `source` feature has an empty name. |
| `primer-test.json` | mbio's `tests/data/primer-test.dna` | A linear record. The primer `rev-mismatch` has one mismatch. |
| `trace-3730.json` | mbio's `tests/data/3730.ab1` | A Sanger read checked against its own trusted bases with one base changed, as mbio's page tests change it. The record is cropped to the 120 bases around that base, its read and its one disagreement, `61 G>C`, with it, and the read's trace to the samples over those bases. It is written on one line. |
| `trace-3730-reversed.json` | mbio's `tests/data/3730.ab1` | `trace-3730` turned to the other strand, so its disagreement is `60 C>G`. Its read is on the reverse strand, and its trace's curves are swapped for the bases they pair with. The samples ascend while the bases they lie over descend. |
| `both-strands-and-insertions.json` | by hand | A feature on both strands, and two insertions, one of them at the origin. |
| `mismatch-across-origin.json` | by hand | A primer with two sites. One site runs across the origin, with a mismatch on each side of it. The other is on the reverse strand. |
| `linear-ends.json` | by hand | A linear record with a feature and an insertion at each end. One CDS reads from its second base, and one is on the reverse strand. Its BsaI site has no cut, because the cut would fall off the end. |
| `n-and-cut-at-origin.json` | by hand | An N in the bases, inside a CDS, so one codon translates as X. An EcoRI cut at 0, the origin. |

The records from mbio carry the cuts of all of mbio's enzymes. The hand-made records carry the
cuts those same enzymes make in their bases.

## Drawing a region

A region to draw is a drawing option, so no record holds one. To test it, draw `colour-test`
over the span `(2600, 2750)`. That span runs across the origin, as its `across` feature does.

## Making the records again

`scripts/write_test_records.py` writes the records from mbio, the test figures in
`tests/figures/`, the test gels in `tests/gels/`, and the test plates in `tests/plates/`. It
runs in mbio's own pixi environment and changes nothing there. It reads each mbio file at the
commit named by `REVISION` in the script. It stops if the mbio code it runs differs from that
commit in `src/`.

From the root of this repo, with mbio checked out at `../liulab-mbio`:

```sh
pixi run --as-is --manifest-path ../liulab-mbio/pyproject.toml python -I scripts/write_test_records.py
```

`--as-is` installs nothing, so a fresh mbio checkout needs `pixi install` in mbio first.

To read a later mbio commit, change `REVISION`, run the script again, and review the changes
before you commit them. The script does not touch the hand-made records.
