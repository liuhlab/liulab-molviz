# Changelog

Every change worth knowing about, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version numbers are CalVer tags
of the form `vYYYY.M.PATCH`, and the tag is where the version comes from — nothing here
sets one.

## [Unreleased]

### Added

- The viewer: a JavaScript file built from TypeScript and shipped inside the package.
- `viewer_script()` returns the viewer's text, for a page to inline.

### Removed

- `greet`, the template's placeholder, and its `molviz greet` command.
