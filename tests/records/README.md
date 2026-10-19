# Test records

Each file here is one record in the viewer's format. A test in `pixi run check` passes every
file through the viewer's check, so the records stay valid as the format grows.

## What each record covers

| File | Made from | What it covers |
| --- | --- | --- |
| `puc19-gfp-product.json` | mbio's `docs/examples/pUC19-GFP/product.dna` | A Golden Gate product. Its `lacZα` CDS is joined across the GFP insert. Some of its primers have 5' tails, and its BsmBI and Esp3I sites run across the origin. |
| `ap1-product.json` | mbio's `docs/examples/ap1-library/product.dna` | A larger product with many features, some on no strand. Its `rop` and `lacI` start with GTG, so their translations start with V. |
| `ap1-block-vector-1.json` | mbio's `docs/examples/ap1-library/block-vector-1.dna` | AP-1's vector before any part goes in, with its `internal stuffer` where the first part goes. |
| `ap1-round-1.json` | mbio's `docs/examples/ap1-library/round-1.dna` | AP-1 after round 1, with `N_JUN` and its barcode in place of the stuffer. |
| `ap1-round-2.json` | mbio's `docs/examples/ap1-library/round-2.dna` | AP-1 after round 2, with `DBD_JUN` joined after `N_JUN`. Round 3 makes `ap1-product`. |
| `colour-test.json` | mbio's `tests/data/colour-test-snapgene.gbk` | Joined, white and grey features. The `split` CDS joins three segments, each later segment with its own colour. The `across` feature runs over the origin. The `source` feature has an empty name. |
| `primer-test.json` | mbio's `tests/data/primer-test.dna` | A linear record. The primer `rev-mismatch` has one mismatch. |
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

`scripts/write_test_records.py` writes the seven records from mbio, the test figures in
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
