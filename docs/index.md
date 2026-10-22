# liulab-molviz

molviz draws DNA. Hand it a plasmid or a PCR product, and it draws a map in the browser. You
can turn the map, zoom in and read the bases on both strands. molviz also draws figures to set
beside a protocol step, agarose gels with their expected bands, and plates with what each well
holds. From Python, it writes each drawing as a page that opens offline, or as an SVG, PNG or
PDF file.

molviz draws only what you hand it. Your code finds the cut sites, translates each coding
sequence and places the features. molviz lays them out and draws them.

## See a map

This is pUC19-GFP, the pUC19 vector with GFP put in by Golden Gate assembly. The viewer draws
it in your browser when the page opens.

<div data-molviz>
<script type="application/json" data-record>
--8<-- "tests/records/puc19-gfp-product.json"
</script>
</div>

Rest the pointer on a feature to see its name, type and place. Scroll over the circle to turn
it. The switches above the map show it as a line, or show its bases.

## Install it

molviz is on PyPI as `liulab-molviz`. To add it to a [pixi](https://pixi.sh) project, run:

```bash
pixi add --pypi liulab-molviz
```

## Go further

- [Draw your first plasmid map](get-started/first-map.md) installs molviz and draws a plasmid
  you type, one step at a time.
- [Choose a drawing](get-started/choose-a-drawing.md) says which drawing answers which
  question, and links to the guide for each one.
- The [record format](reference/record.md) lists every key a record holds. The
  [Python API](api.md) lists each function, the [options](api.md#options) that `draw` takes,
  and [the command line](api.md#the-command-line).
- [What molviz draws and what you hand it](explanation/what-molviz-draws.md) says which work is
  your code's and which is molviz's.
