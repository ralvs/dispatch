# 0039 — UI primitives: line fields, depth elevation, control/card radii

Date: 2026-08-04

Supersedes the **geometry** section of [0013](./0013-vercel-geist-design-system.md).
Palette, type, and semantic color from 0013 still stand.

## Context

Dispatch had no UI primitive layer — every control was a hand-typed
`className`. An audit found six border radii against 0013's declared two,
three badge radii, six primary-button recipes, competing input languages
(bottom-line vs boxed), and ad-hoc elevation. A `/compare` bake-off ran
field shape (line | box) × elevation (flat | depth) over shared primitives.
(That route is gone — it was deleted after the revision A refactor, along with
the proxy matcher exemption that kept it unauthenticated. The decision below
stands on its own; the surface was scaffolding.)

Winner: **line fields · depth elevation**.

## Decision

### Geometry

| Token | Value | Use |
|---|---|---|
| `--radius-control` / `rounded-control` | 10px | Buttons, chips, badges, popovers, triggers |
| `--radius-card` / `rounded-card` | 16px | Cards, dialogs, modals |
| `--radius-pill` / `rounded-pill` | 9999px | Dock capsule + circular marks only |
| `--radius-mark` / `rounded-mark` | 3px | Checkbox squares |

Pill is **not** for badges, alert chips, or CTAs. Circular color swatches and
status dots are marks, not chrome.

### Fields — line

All text fields share one shell (`.field-shell`), driven by CSS variables:

```
--field-bg: transparent
--field-radius: 0
--field-border-width: 0 0 1px 0
--field-shadow: none
```

No title-vs-meta chrome split. Size changes height and type scale only.
Primitives: `Field`, `Input`, `Select`, `Textarea` in `components/ui/`.

### Elevation — depth (shadow only)

No background swap for lift. Cards, dialogs, popovers, and the dock read:

```
--elevation-card
--elevation-overlay
```

- **Dark**: subtle white glow (black falloff is invisible on `#0a0a0a`)
- **Light**: subtle dark soft shadow (same geometry, inverted ink)

Utilities: `.elevation-card`, `.elevation-overlay`, `.elevated-panel`.

### Icons

`lucide-react` via `components/ui/icon.tsx` at three sizes (14 / 16 / 20),
`strokeWidth` 1.5. Hand-rolled glyphs and text `★ ✓ × ⌄` are retired.

### Component layer

`components/ui/` — `Button`, `Field`/`Input`/`Select`/`Textarea`, `Checkbox`,
`Radio`, `Badge`, `Card`, `Icon` — built with `tailwind-variants`. No shadcn.
Declining Base UI means focus rings, `aria-invalid` / `aria-describedby`,
and real `<label>` hit areas are owned by these primitives.

## Consequences

- App code composes primitives; it does not retype control class strings.
- 0013's 6px/12px bimodal geometry and "pills for badges / capture chips /
  sign-in CTA" are obsolete (capture chips gone per 0020/0022).
- Changing field shape or elevation later is a token edit in
  `app/globals.css`, not a component fork.
