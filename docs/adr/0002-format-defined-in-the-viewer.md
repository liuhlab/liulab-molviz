---
search:
  exclude: true
---

# The format is defined once, in the viewer, and Python runs the viewer's check

What a caller hands over is a record. Its shape is written once, as a valibot schema in the
viewer's TypeScript. The types come from that schema, and the viewer checks every record before
it draws. The Python package holds no copy: before it writes a page or exports, it runs the same
check in mini-racer and raises its error. Two copies would drift, and export already runs the
viewer in mini-racer.

Unknown keys are errors, so a misspelt key fails instead of vanishing. A record names no format
version: adding a kind or an optional key breaks nothing, and a version key arrives with the
first change that does. A record without one is version 1.

Records carry no IDs. A drawing takes its record, and a page that draws one record several
times embeds it once.

## Considered options

- **A JSON Schema file as the source**, with TypeScript types generated from it and Python
  checking with `jsonschema`: two checkers that can disagree.
- **Python dataclasses as the source**: the format would live on the side that does no drawing.
- **A document of records keyed by ID**, which each drawing names: every caller invents IDs and
  keeps them unique.

## Consequences

Python callers build plain dicts with no static types, and writing a page starts a JavaScript
runtime.
