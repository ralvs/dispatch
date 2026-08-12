# 0049 — Field troughs join the radii

Date: 2026-08-12

Supersedes the **fields** section of [0039](./0039-ui-primitives-line-depth.md).
Elevation, control/card/pill radii, and the primitive layer from 0039 still stand.

## Context

0039 shipped line fields (transparent, radius 0, a 1px bottom rule) after a
bake-off against boxed fields. Revision A then rounded everything else —
cards at 22px, controls at 12px, pills for tabs, Ask, Capture, and the dock.
Fields stayed the hard exception: a square underline whose focus was the
global 2px accent outline at a 2px offset. That frame read as a large square
border on a page that is otherwise curly.

## Decision

Fields sit in the same trough language as the tab group.

```
--field-bg: var(--surface-2)
--field-radius: 9999px          /* single-line */
--field-radius-block: 22px      /* textarea, display titles */
--field-border-width: 0
--field-focus-ring: inset 0 0 0 2px var(--accent)
```

The inset ring *replaces* the global offset outline on `.field-shell`. Hover
is a colour mix on the trough, not a border. Invalid uses the same inset
geometry in `--error`.

Shape is still one shell. Size still only changes height and type scale.
Changing the trough later is still a token edit in `app/globals.css`.

## Consequences

- Line fields are retired. Call sites that only applied `.field-shell` inherit
  the trough; they do not retype chrome.
- 0039's "winner: line fields" is obsolete. Depth elevation is not.

Superseded for field shape by [0050](./0050-field-soft-rule.md).
