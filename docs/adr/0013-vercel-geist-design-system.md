# 0013 — Adopt the Vercel Geist design system, dark by default, with color

Date: 2026-07-19

## Context

Dispatch shipped with an "editorial newspaper" identity (warm umber palette,
terracotta accent, Newsreader serif, 0-radius geometry). A first restyle to
the ElevenLabs system (all warm-stone monochrome) was rejected as too
colorless. Renan asked for the Vercel Geist system instead (see
DESIGN-vercel.md analysis), with the explicit instruction to actually use its
colors, and dark mode stays the default.

## Decision

- **Palette**: the Geist ink-and-grey ladder. Light is the documented system
  (`#fafafa` canvas, white cards, `#171717` ink, `#ebebeb` hairlines). Dark
  (default) is the Geist dark inversion (`#0a0a0a` canvas, `#141414` cards,
  `#ededed` ink) — the spec is light-only, so the dark values follow
  Vercel's own product dark mode.
- **Color is present, not banished.** `accent-*` tokens resolve to Vercel
  Blue (`#0070f3`, lighter `#52a8ff` tiers on dark) — active nav, focus
  rings, highlights, the capture FAB. Semantic `error`/`warning`/`success`
  tokens carry the spec's semantic scale. The develop / preview / ship
  gradients live as `gradient-*` utilities: the Today masthead sets
  "Dispatch" in blended mesh gradient text, and the cadence bar's slip
  overflow fills with the ship gradient (red→amber). Gradients stay
  decoration — never chrome surfaces.
- **Type**: back to Geist Sans + Geist Mono (the app's original faces —
  Vercel's own). `.font-serif` remains in markup as the display slot but
  resolves to Geist Sans 600 with -0.02em tracking (`.display-tight` steps
  to -0.05em at hero scale). Geist Mono returns for the uppercase eyebrows,
  which map 1:1 to the spec's `mono-eyebrow`.
- **Geometry** (superseded by [0039](./0039-ui-primitives-line-depth.md)):
  originally bimodal 6px/12px per the Geist spec. 0039 ships control 10px /
  card 16px, line fields, and depth elevation tokens instead.

## Consequences

- Components keep referencing semantic tokens; the reskin lives in
  `app/globals.css` + `app/layout.tsx` plus mechanical radius edits.
- `font-serif` no longer means serif; it means "display tier". A later
  cleanup could rename the classes. **It did, three identities later:
  [0042](./0042-the-page-header-is-the-fine-locator.md) deletes the class and
  moves its 53 call sites to `.type-title`.** The cost of deferring it is on the
  record — a class that set no family, named for a family the system did not
  have, made every untouched page look plausible for two more restyles.
- Geist has no italic — `italic` on quotes renders browser-synthesized
  oblique. Acceptable for now.
