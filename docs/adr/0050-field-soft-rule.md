# 0050 — Fields are a soft rule, not a trough

Date: 2026-08-12

Supersedes the field shape in [0049](./0049-field-troughs-join-the-radii.md).
Elevation and control/card/pill radii still stand.

## Context

0049 put fields in a `surface-2` trough with an inset 2px accent ring so they
would share the app's curly geometry. The trough matched the tab group; the
ring read as a hard border, and treating the note title as a field boxed the
page's name.

A bake-off of trough vs rule vs ghost-title languages landed on **B6**: keep
the rule, drop the trough and the ring, put a quiet caption above the value,
and warm the caption with the rule on focus.

## Decision

```
--field-bg: transparent
--field-radius: 0
--field-border-width: 0 0 1px 0
```

Focus is colour on that rule (`--accent`) plus the 12px caption
(`--accent-ink`). Display titles and the note body use the same rule;
the body warms via `:focus-within`. Invalid uses the same geometry in
`--error`.

`.field-unit:focus-within > label` is how the caption warms. Forms that stack
fields leave 28px (`space-y-7`) from one rule to the next caption.

## Consequences

- 0049's trough and inset ring are retired.
- Changing field shape later is still a token + `.field-shell` edit.
