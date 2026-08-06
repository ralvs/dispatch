# 0042 — Warm paper: light by default, cards on a tinted ground

Date: 2026-08-06

Supersedes [0013](./0013-vercel-geist-design-system.md) (Vercel Geist, dark by
default, uppercase mono eyebrows) and the geometry table in
[0039](./0039-ui-primitives-line-depth.md) (control 10 / card 16, line fields).
The primitive **layer** 0039 established stands — this only changes what the
primitives are made of.

## Context

An audit against the anti-slop checklist came back almost entirely clean:
loading, empty and error states everywhere, no `100vh`, no dead links, focus
rings, reduced-motion, AA-checked ink. The design was not sloppy. It was
disliked anyway.

Renan supplied two references (bydefault.so and collectiveos.vercel.app) with
the instruction to look at the product surfaces, not the marketing pages. Their
shared language, read off the DOM rather than guessed at:

| | References | Dispatch under 0013 |
|---|---|---|
| Canvas | warm paper (`#f6f3ec`) | near-black `#0a0a0a` |
| Cards | white, floating, soft tinted shadow | none — hairlines on a flat plane |
| Neutrals | every grey tinted warm | zero hue |
| Radii | 12 / 20 / 24 / 32 / pill | 10 / 16 |
| Titles | 700 | 600 display only |
| Controls | pill, sentence case | `font-mono uppercase tracking-widest` |

The gap was **material**, not hygiene, which is why a slop audit could not see
it. Three things carried most of the austerity:

1. Every button in the app was uppercase mono, so every control read as a
   terminal command.
2. There was no card surface. `--field-bg` was transparent, fields were
   bottom-border-only at radius 0, and lists were hairlines directly on the
   canvas.
3. The neutral ramp had no hue at all, and dark mode inverted its shadows into
   a white glow to compensate.

## Decision

Adopt a **warm paper** system. Light is the default and the designed-for mode;
dark is the same system with the lights off, not a separate palette.

### Ground and ink

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f5f2ea` warm paper | `#1a1815` warm charcoal |
| `--surface` | `#ffffff` | `#232019` |
| `--ink` | `#1c1a17` | `#f2ede3` |
| `--line` | `#e8e2d6` | `#332e25` |

The ink ladder is tuned for WCAG AA against its own canvas: light 8.4 / 6.4 /
4.9, dark 6.9 / 5.4 / 4.7.

**The accent stays Vercel Blue** (`#0070f3`, `#4d9fff` in dark). It is the one
thing 0013 got right, a cool accent on a warm ground is exactly what both
references do, and keeping it means links, focus rings and active nav do not
have to be relearned. It also keeps the palette out of the beige-and-brass
trap that every warm-paper redesign falls into.

Shadows carry the ground's hue and are never pure black. Dark mode now uses a
real shadow rather than 0013's inverted white glow, because a lighter surface
on a warm canvas already reads as lifted.

### Geometry (supersedes 0039's table)

| Token | Value | Use |
|---|---|---|
| `--radius-control` | 12px | Nav rows, popovers, triggers |
| `--radius-card` | 20px | Cards, dialogs, row groups |
| `--radius-pill` | 9999px | Buttons, badges, chips, dock |
| `--radius-mark` | 6px | Checkbox squares |
| `--field-radius` | 10px | Inputs, selects, textareas |

Fields are **filled and rounded** (`--field-bg: #faf8f3`, 1px border on all
sides), reversing 0039's line-field bake-off winner. That result was correct
for a flat dark plane and is wrong on paper, where an underline reads as an
unfinished box.

### Type

One family (Geist) as before. What changes:

- **The uppercase mono eyebrow is retired.** `font-mono text-eyebrow uppercase
  tracking-widest` is replaced by `.label` — 12px, weight 600, sentence case.
  This was ~110 occurrences across 68 files.
- **Mono is for numerics and code only.** Times, counts, priorities and code
  blocks keep it; meta lines, event titles, and note prose do not.
- **Display goes to 700** (was 600), tracking `-0.02em`, `text-wrap: balance`.
- Date helpers return sentence case: `Thu · Aug 6 · Week 32`, `Today`,
  `Yesterday`, `Tomorrow`.

### Grouping

Row groups float as cards (`.list-card`): surface fill, hairline border, card
radius, tinted shadow, with rows keeping their own `hairline` as the internal
divider and the trailing one dropped. Hairlines survive only as dividers
*inside* a group, never as the group itself.

### Retired

- The rainbow `gradient-text-mesh` masthead wordmark. It is the single most
  recognisable AI-design tell, and its stops were unreadable on paper. The
  wordmark is now solid ink.
- `gradient-ship` on the cadence bar. Slipping a cadence is a warning, so it
  reads as the semantic warning colour.

## Consequences

- Anyone who had set the theme cookie to `dark` keeps dark; everyone else lands
  on light. The boot script's fallback flips from dark to light.
- `--text-eyebrow` is still a 12px scale token, but no longer implies caps or
  mono. Call sites that want a label use `.label`.
- 0039's primitive layer is unchanged: one `tv()` object per primitive, call
  sites compose rather than retype. Only the values moved.
- `app/compare` is left on the old system on purpose — it is the bake-off
  fixture that produced 0039 and rewriting it would destroy the comparison.
