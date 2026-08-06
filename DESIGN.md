---
name: Dispatch
description: Personal operations dashboard — capture in, order out.
colors:
  bg: "#0a0a0a"
  surface: "#141414"
  surface-2: "#1f1f1f"
  ink: "#ededed"
  ink-2: "#a1a1a1"
  ink-3: "#8f8f8f"
  ink-4: "#8a8a8a"
  line: "#232323"
  line-strong: "#343434"
  accent: "#0070f3"
  accent-bg: "rgba(0, 112, 243, 0.16)"
  accent-ink: "#52a8ff"
  accent-slip: "#47a1ff"
  error: "#ff4d4d"
  warning: "#f5a623"
  success: "#50e3c2"
  light-bg: "#fafafa"
  light-surface: "#ffffff"
  light-surface-2: "#f2f2f2"
  light-ink: "#171717"
  light-ink-2: "#4d4d4d"
  light-ink-3: "#5f5f5f"
  light-ink-4: "#6b6b6b"
  light-line: "#ebebeb"
  light-line-strong: "#d9d9d9"
  light-accent-ink: "#0761d1"
  light-error: "#ee0000"
  light-warning: "#ab570a"
  light-success: "#0761d1"
typography:
  display:
    fontFamily: "Geist, Arial, ui-sans-serif, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.05em"
  headline:
    fontFamily: "Geist, Arial, ui-sans-serif, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, Arial, ui-sans-serif, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, Arial, ui-sans-serif, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  meta:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  eyebrow:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0.08em"
rounded:
  none: "0"
  mark: "3px"
  control: "10px"
  card: "16px"
  pill: "9999px"
spacing:
  compact: "16px"
  default: "20px"
  comfortable: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-secondary-hover:
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.error}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "36px"
  badge-neutral:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.control}"
    padding: "1px 6px"
  badge-accent:
    backgroundColor: "transparent"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.control}"
    padding: "1px 6px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "0"
  dock:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.pill}"
    padding: "4px"
    height: "56px"
---

# Design System: Dispatch

## Overview

**Creative North Star: "The Instrument Panel"**

Dispatch looks the way it does because one person reads it every morning to
find out what his day is. A near-black canvas carries a single ink ladder, a
single blue signal, and hairline rules that divide without decorating. Nothing
competes for attention, which is what makes the two or three things that *do*
carry color legible at a glance. The reference is cockpit instrumentation: dense
information, monospaced labels, and color reserved for state that matters.

The system is austere by construction, not by omission. Type is one family
(Geist Sans and Geist Mono) working across two registers — a 600-weight display
voice with tight negative tracking for anything a human named, and an
uppercase mono eyebrow for anything the system labeled. That split does most of
the hierarchical work, so headings rarely need size to establish rank. Surfaces
are flat and hairline-bounded; depth arrives only as a soft shadow on things
that genuinely float.

Two visual rejections are on the record. An "editorial newspaper" identity
(warm umber, terracotta accent, Newsreader serif, zero radius) was replaced. A
fully monochrome restyle was then rejected for being colorless — which is why
the blue survives at all. The mesh-gradient wordmark is the one element that was
inherited from the Geist styling rather than chosen; it is present but not
load-bearing, and a replacement world owes it nothing.

**Key Characteristics:**

- Dark by default; light is a full peer theme, not an afterthought
- One type family, two registers: display sans and uppercase mono eyebrow
- Hairlines divide, shadows lift, backgrounds never swap to signal state
- One accent color, governed by both a role rule and a budget
- Ink ladder tuned for WCAG AA (4.5:1) rather than for visual matching

## Colors

An ink-and-grey ladder on a near-black canvas, interrupted by exactly one blue.
Both themes are complete and normative; dark is the default.

### Primary

- **Signal Blue** (`accent`): the only chromatic voice in the chrome. Active
  nav item, links, focus rings, the capture button, and the accent-tinted
  selection background. On dark it lightens to **Signal Blue Raised**
  (`accent-ink`) for text-on-dark contrast; on light it darkens instead.
- **Signal Blue Wash** (`accent-bg`): a low-alpha fill for selected or active
  rows. Never a border, never text.

### Neutral

- **Void** (`bg`): the canvas. Near-black on dark, near-white on light — never
  pure `#000` or `#fff`.
- **Slab** (`surface`): cards, dialogs, the dock capsule. One step off the
  canvas, no more.
- **Slab Raised** (`surface-2`): the rare second layer, for a surface sitting
  on a surface.
- **Ink** (`ink`): primary text and the primary button's fill.
- **Ink Muted** (`ink-2`) → **Ink Quiet** (`ink-3`) → **Ink Faint** (`ink-4`):
  the descending ladder for secondary text, labels, and placeholders. On dark,
  `ink-3` and `ink-4` land near-identical *on purpose* — a `#0a0a0a` canvas
  leaves no room for four muted greys that all clear AA, so the bottom two
  rungs converge. That is a documented tradeoff, not a bug to "fix".
- **Hairline** (`line`) and **Hairline Strong** (`line-strong`): the 1px rules
  that do all the structural dividing. `line-strong` bounds cards and controls;
  `line` divides content within them.

### Tertiary (semantic)

- **Alarm** (`error`), **Caution** (`warning`), **Clear** (`success`): state
  only — validation, overdue work, confirmation. They are never brand colors
  and never appear as decoration.

### Named Rules

**The Two-Gate Rule.** Blue passes a role gate first: it marks interactivity or
current position — a link, a focus ring, the active tab, the capture
affordance. If it is not one of those, it is not blue. A budget gate then backs
that up: when legitimate uses stack on one screen, cut back to a couple of blue
elements. The role decides what is *allowed*; the budget decides what actually
ships.

**The Semantic Names Only Rule.** Components reference `--ink-3`, never
`#8f8f8f`. Every color reaches a component through a semantic token, which is
what makes the two themes a variable swap rather than a fork.

**The Tuned-For-Contrast Rule.** The ink ladder is tuned to WCAG AA (4.5:1),
not to the source system's original values. When contrast and fidelity conflict,
contrast wins.

## Typography

**Display Font:** Geist Sans (with Arial, ui-sans-serif)
**Body Font:** Geist Sans (same family)
**Label/Mono Font:** Geist Mono (with ui-monospace, SFMono-Regular, Menlo)

**Character:** One family doing two jobs. Geist Sans at 600 with negative
tracking is confident and compact — it reads as a title without needing size.
Geist Mono in uppercase with wide tracking is the system's own voice: every
label, timestamp, count, and status the app generated rather than the user
wrote. You can tell who wrote a piece of text by which face it is set in.

### Hierarchy

- **Display** (600, `text-4xl` / 2.25rem, `-0.05em` tracking): the "Dispatch"
  masthead only. The tracking tightens as size grows; this is the tightest tier.
- **Headline** (600, `text-3xl` / 1.875rem, `-0.02em`): page titles. The most
  common large-type size in the app by a wide margin.
- **Title** (600, `text-lg` / 1.125rem, `-0.02em`): card and list-row titles,
  desktop rail nav items.
- **Body** (400, `text-sm` / 0.875rem): the workhorse. Content, field values,
  descriptions.
- **Meta** (400, mono, 12px): timestamps, counts, secondary system text.
- **Eyebrow** (500, mono, 11px, `0.08em`, uppercase): section labels, field
  labels, button text, badges, nav items. The single most-used type role in the
  system.

### Named Rules

**The Two Voices Rule.** Sans is for what a human wrote; mono uppercase is for
what the system labeled. A user's task title is never mono; a field label is
never sans.

**The Tighter As It Grows Rule.** Letter-spacing goes more negative as type
gets larger — `-0.02em` at title and headline, `-0.05em` at display. Large type
is never set at default tracking.

**The Button-Speaks-Mono Rule.** Every button label is uppercase mono eyebrow,
at every size. Buttons are system chrome, not content.

## Layout

A single-column mobile view that becomes a rail-plus-content desktop view; there
is no intermediate tablet composition.

- **Mobile:** content is capped at `max-w-md` with `20px` horizontal padding,
  `24px` top padding, and `112px` of bottom padding to clear the floating dock.
  Navigation is the dock, fixed at the bottom.
- **Desktop (`lg` and up):** a fixed `208px` left rail (`w-52`, with `240px` of
  content offset), and content widening to `max-w-6xl` with `40px` top padding.
  The dock disappears entirely.
- **The shell owns the viewport.** The authed shell is a fixed-height flex
  column that fills the screen; only the content region scrolls, with
  `overscroll-contain`. In a browser tab that height is `100dvh`; in an
  installed PWA it is a JS-measured value, because no viewport unit is
  trustworthy there. Every route carries its own loading boundary, so
  navigation reveals skeleton structure rather than a blank interval.
- **Rhythm:** vertical spacing is Tailwind's 4px-based scale, with `space-y-4`
  (16px) as the default gap between stacked blocks. Card padding runs
  compact (16px) → default (20px) → comfortable (24px).
- **Safe areas:** bottom inset is honored by the dock, top inset inside the
  shell rather than on `body` — putting it on `body` pushes the document past
  the viewport in an installed iOS PWA and reintroduces document scroll.

### Named Rules

**The One Scroll Container Rule.** The document does not scroll. The shell
fills the viewport and the content region scrolls inside it.

## Elevation & Depth

Depth is **shadow only** — a deliberate choice made by running a live bake-off
of field-shape × elevation combinations and picking the winner. Surfaces never
swap their background color to signal lift. A card and a dialog sit on the same
`surface`; the dialog simply casts a larger shadow.

Because the canvas is near-black, a black falloff would be invisible. The dark
theme therefore lifts with a subtle **white glow**, and the light theme mirrors
the identical geometry with a conventional dark shadow.

### Shadow Vocabulary

- **Card lift** (`--elevation-card`): dark
  `0 1px 2px rgba(255,255,255,0.04), 0 3px 10px rgba(255,255,255,0.05)`; light
  the same geometry in `rgba(0,0,0,…)`. Cards and resting panels.
- **Overlay lift** (`--elevation-overlay`): dark
  `0 2px 6px rgba(255,255,255,0.05), 0 8px 20px rgba(255,255,255,0.06)`; light
  mirrored. Dialogs, popovers, and the floating dock.

### Named Rules

**The No Background Swap Rule.** Lift is expressed as shadow. A surface that
needs to feel raised gets a shadow, not a lighter fill.

**The Mirror Rule.** Light and dark shadows share geometry and differ only in
ink. A change to one is a change to both.

## Shapes

Four radii, each with an assigned job, and no fifth:

- **Control (10px)** — buttons, badges, chips, popovers, triggers.
- **Card (16px)** — cards, dialogs, modals.
- **Mark (3px)** — checkbox squares only.
- **Pill (9999px)** — the mobile dock capsule and circular marks (status dots,
  color swatches) only.
- **None (0)** — text fields, by way of the field-shape token.

Borders are the primary form-giver: a 1px hairline bounds nearly every surface,
and `line-strong` versus `line` is how the system distinguishes a container's
edge from a divider inside it.

Text fields are **lines, not boxes** — transparent background, no radius, a
single 1px bottom border. All four field shapes (input, select, textarea, and
the native date/time controls) share one shell driven by `--field-*` variables,
so size changes height and type scale only and never forks the chrome.

### Named Rules

**The Pill Is Not For Badges Rule.** Pill radius belongs to the dock capsule
and to circular marks. Badges, alert chips, and CTAs take control radius.

**The One Shell Rule.** Field shape lives entirely in `--field-*` tokens.
Changing every field in the app from line to box is a token edit in
`globals.css`, not a component fork.

## Components

All primitives live in `components/ui/` and are built with `tailwind-variants`
over a shared `tv` instance. No component library — declining one means focus
rings, `aria-invalid` / `aria-describedby` wiring, and real `<label>` hit areas
are owned here rather than inherited.

### Buttons

Compact and system-voiced; a button never looks like content.

- **Shape:** control radius (10px), heights `28 / 36 / 44px` (sm / md / lg).
- **Primary:** ink fill with canvas-colored text — an inversion, not a colored
  button. The accent is never a button fill.
- **Secondary:** transparent with a `line-strong` border and quiet ink; the
  border goes accent on hover.
- **Tertiary:** the same, one step quieter (`line` border).
- **Ghost:** no border; picks up a `surface` fill on hover.
- **Danger / danger-soft:** transparent with an error-tinted border, or bare
  faint ink for low-stakes destructive affordances.
- **States:** color-only transitions, `active:opacity-70` for press,
  `disabled:opacity-50`, and a 2px accent focus ring at 2px offset. Pending
  state sets `aria-busy` and drops to 50% opacity.

### Inputs / Fields

- **Style:** transparent, zero radius, 1px bottom hairline. Heights match the
  button ladder.
- **Focus:** the border strengthens to `line-strong` *and* a 2px accent outline
  appears at 2px offset. Hover strengthens the border alone.
- **Error:** the border goes `error`; the message renders as 12px error text
  with `role="alert"`, wired through `aria-describedby`.
- **Labels:** uppercase mono eyebrow in quiet ink, 8px above the control.
- **Native date/time:** the picker glyph sits at 40% opacity and rises to 85%
  on hover or focus; an empty control mutes its skeleton digits to faint ink.

### Badges / Chips

- **Style:** control radius, 1px border, transparent fill, 10px mono. Tone
  variants (`neutral`, `accent`, `error`, `warning`, `success`, `muted`) set
  the border at 40% alpha and the text at full strength.
- **Never filled.** A badge is a bordered outline, always.
- Person mentions and note affordances derive their class strings from the same
  variant object, so chip chrome cannot drift from badge chrome.

### Cards / Containers

- **Corner Style:** card radius (16px).
- **Background:** `surface`, one step off the canvas.
- **Border:** 1px `line-strong`.
- **Shadow:** card lift (see Elevation).
- **Internal Padding:** 20px default; 16px compact, 24px comfortable, 0 for
  full-bleed content.

### Navigation

Two entirely separate treatments, never both visible.

- **Mobile dock:** a floating pill capsule, 56px tall, centered above the
  bottom safe-area inset. Translucent `surface` at 75% with `backdrop-blur-xl`
  and `backdrop-saturate-150`, a 70%-alpha `line-strong` hairline, and overlay
  lift. Items are uppercase mono eyebrow; the active one takes the accent. The
  capture button is a second capsule of identical height and material sitting
  beside it — it portals into a slot in the same flex row so the two can never
  drift apart.
- **Desktop rail:** a fixed 208px column against the canvas (not a surface),
  divided by hairlines, with a `border-r` edge. Primary items are `text-lg`
  display sans; secondary items drop to mono meta uppercase. Active state is
  color, never a background fill.

### Dialog

One modal shell for the whole app: portalled overlay, focus trap, scroll lock,
`inert` on the background, Escape and backdrop dismissal. Card radius,
`line-strong` border, `surface` background, overlay lift, capped at `85dvh` with
its body scrolling. Children mount only while open, which is what makes
reopening a form show fresh values. Focus moves to `[data-autofocus]` (or the
first focusable element) after paint, and returns to the trigger on close.

### Icons

Lucide only, through one wrapper, at three sizes (14 / 16 / 20) matching the
control-height ladder, `strokeWidth` 1.5. The wrapper marks an icon
`aria-hidden` automatically unless it carries an accessible name. Hand-rolled
glyphs and text symbols (`★ ✓ × ⌄`) are retired.

### Signature Component: the masthead wordmark

"Dispatch" set in 36px display sans at `-0.05em`, filled with a five-stop mesh
gradient (blue → cyan → violet → magenta → amber) clipped to the text. The light
theme uses a separately darkened stop set, because the dark-theme stops go
near-invisible on a `#fafafa` canvas. This is the only ornamental element in the
system, and it was inherited from the source styling rather than chosen.

## Do's and Don'ts

### Do:

- **Do** route every color through a semantic token (`--ink-3`, `--accent`).
  Raw hex in a component is a defect.
- **Do** set system-authored text — labels, counts, timestamps, button text —
  in uppercase mono eyebrow (11px, `0.08em`), and user-authored text in sans.
- **Do** use the four assigned radii and only those: 10px controls, 16px cards,
  3px checkbox marks, pill for the dock and circular marks.
- **Do** express lift as shadow, mirroring the same geometry across both themes.
- **Do** compose the `components/ui/` primitives. App code does not retype
  control class strings.
- **Do** tighten letter-spacing as type scales up.
- **Do** give every interactive surface a visible keyboard ring — the global
  `:focus-visible` rule is a floor, and a component may replace it but never
  remove it.
- **Do** keep both themes complete. Every token has a light and a dark value.

### Don't:

- **Don't** use pill radius for badges, alert chips, or CTAs.
- **Don't** fill a button, badge, or any chrome with the accent. Blue marks
  interactivity and position; the primary button inverts to ink instead.
- **Don't** swap a background color to signal elevation.
- **Don't** box a text field. Fields are transparent with a single bottom
  hairline, and the shape lives in `--field-*` tokens.
- **Don't** let gradients touch chrome. The mesh gradient is decoration, in one
  place.
- **Don't** introduce a second icon library, hand-rolled glyph, or text symbol
  as an icon.
- **Don't** "fix" the near-identical `ink-3` / `ink-4` on dark. The convergence
  is a deliberate consequence of holding AA contrast on a `#0a0a0a` canvas.
- **Don't** add a top safe-area inset to `body`; it breaks the installed PWA's
  viewport and pushes the dock off-screen.
- **Don't** ship a component with animation that ignores
  `prefers-reduced-motion` — the global reduce rule is honored system-wide, and
  there is currently no motion vocabulary beyond color transitions and
  `active:opacity-70`.
