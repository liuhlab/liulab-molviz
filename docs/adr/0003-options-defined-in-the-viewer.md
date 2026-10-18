---
search:
  exclude: true
---

# A drawing's options are defined once, in the viewer, and Python passes them through

The options a drawing takes, such as `span`, `highlight` and `enzymes`, are a valibot schema in
the viewer beside the record's, checked the same way: an unknown option is an error. Python's
`molviz.draw(record, **options)` hands them on untouched and names none of them. Spelling each
option as a Python keyword would be a second list to keep in step with the viewer's, the drift
[defining the format in the viewer](0002-format-defined-in-the-viewer.md) rules out for records.

## Considered options

- **Each option a Python keyword argument**, so an editor completes the names and pyright
  checks them.

## Consequences

A misspelt option fails when `draw` runs, with the viewer's message, not when the caller's code
is type-checked. Python's docstring points at the viewer's list of options instead of
repeating it.
