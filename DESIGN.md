---
name: Dispatch
description: Personal operations dashboard — capture in, order out.
colors:
  bg: "#fafafa"
  surface: "#ffffff"
  surface-2: "#f0efed"
  ink: "#2a2524"
  ink-2: "#57534e"
  ink-3: "#8c8681"
  ink-4: "#b4aea8"
  line: "#e5e5e5"
  line-strong: "#d6d3d0"
  accent: "#f15a0f"
  accent-bg: "#fdf0e8"
  accent-ink: "#c2450a"
  error: "#d92d20"
  warning: "#9e6b00"
  success: "#1f8d54"
  priority-high: "#d92d20"
  priority-med: "rgba(217, 45, 32, 0.42)"
  domain-engine: "#514ad4"
  domain-health: "#2aa649"
  domain-family: "#c345fc"
  domain-spirit: "#8b6031"
  domain-finance: "#0a7cfe"
  domain-code: "#1b93ba"
  domain-travel: "#ffcc0f"
  domain-pine: "#158266"
  domain-burgundy: "#db149b"
  dark-bg: "#1a1817"
  dark-surface: "#232020"
  dark-surface-2: "#2b2725"
  dark-ink: "#f5f2ef"
  dark-ink-2: "#b8b1ab"
  dark-ink-3: "#8d8681"
  dark-ink-4: "#6b645f"
  dark-line: "#322e2c"
  dark-line-strong: "#423d3a"
  dark-accent: "#ff6f2c"
  dark-accent-bg: "#33211a"
  dark-accent-ink: "#ff8f5c"
  dark-error: "#ff6a5e"
  dark-warning: "#d1a44a"
  dark-success: "#54b97d"
  dark-priority-high: "#ff6a5e"
  dark-priority-med: "rgba(255, 106, 94, 0.45)"
  dark-domain-engine: "#5e5ae6"
  dark-domain-health: "#30d158"
  dark-domain-family: "#c756fc"
  dark-domain-spirit: "#a5733c"
  dark-domain-finance: "#318ffe"
  dark-domain-code: "#2cc9fc"
  dark-domain-travel: "#ffd60a"
  dark-domain-pine: "#21b18c"
  dark-domain-burgundy: "#fc2cb4"
typography:
  hero:
    fontFamily: "Geist, Arial, ui-sans-serif, sans-serif"
    fontSize: "56px"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-1.4px"
  display:
    fontFamily: "Geist, Arial, ui-sans-serif, sans-serif"
    fontSize: "44px"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-1.1px"
  headline:
    fontFamily: "Geist, Arial, ui-sans-serif, sans-serif"
    fontSize: "36px"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.9px"
  title:
    fontFamily: "Geist, Arial, ui-sans-serif, sans-serif"
    fontSize: "30px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.75px"
  lead:
    fontFamily: "Geist, Arial, ui-sans-serif, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, Arial, ui-sans-serif, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  section:
    fontFamily: "Geist, Arial, ui-sans-serif, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "-0.02em"
  small:
    fontFamily: "Geist, Arial, ui-sans-serif, sans-serif"
    fontSize: "14px"
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
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0.1em"
  micro:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  none: "0"
  mark: "7px"
  control: "12px"
  card: "22px"
  pill: "9999px"
spacing:
  compact: "16px"
  default: "20px"
  comfortable: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "40px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "40px"
  button-control:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-control-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
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
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "22px 24px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px"
  tab-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: "7px 18px"
  tab-rest:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: "7px 18px"
  dock-tab-active:
    backgroundColor: "{colors.accent-bg}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.pill}"
    padding: "0 9px"
  dock-action:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
    height: "54px"
    width: "54px"
  chip-allday:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.small}"
    rounded: "{rounded.control}"
    padding: "0 13px"
    height: "30px"
---

# Design System: Dispatch

## Overview

**Creative North Star: "The Measured Day"**

Dispatch is one person's instrument for finding out what today is, and the
system is built around a single act: measuring. The day tape measures committed
time against free time. A ring measures routines done against routines left. A
counter measures what is open against what is late. Everything else — the
paper-white ground, the warm stone ink, the one orange — exists to keep those
measurements legible, and nothing on a page is allowed to compete with them.

Type and colour are lifted from bydefault.so exactly, and geometry from
collectiveos: Geist Sans at **two weights only**, a 56/44/36/30/18/16/14/12
ramp, a neutral-50 ground under a warm stone ink ladder, one orange accent, and
large soft-cornered cards on a gentle lift. Hierarchy comes from size and colour
and never from weight, because there is no weight above 500 to reach for. The
result is quiet without being cold: the warmth is in the greys, not in
decoration.

Three visual worlds have been rejected before this one, and each rejection is
load-bearing. An editorial identity (warm linen, terracotta, a serif display
face) was replaced. A fully monochrome restyle was rejected for being
colourless. The Vercel/Geist system that followed — near-black canvas, Signal
Blue, 600-weight display type, a mesh-gradient wordmark — is the immediate
predecessor and the direct anti-reference for this one: revision A is
light-first, is 500 at its heaviest, and has no gradient anywhere.

**Key Characteristics:**

- Light by default; dark is a complete peer, not an afterthought
- Two type weights, ever: 400 and 500
- One orange, and it means exactly one thing: this needs you
- Nine measured domain colours, which are data — never decoration
- Large radii and a soft warm lift; hairlines still do the dividing
- Shape distinguishes kinds; colour distinguishes instances

## Colors

A warm stone ink ladder on a neutral-50 ground, interrupted by exactly one
orange, with a separate measured palette that belongs to the data rather than
to the chrome.

### Primary

- **Dispatch Orange** (`accent`): the whole chromatic voice of the chrome. The
  brand mark, overdue counts, `6d late` labels, a starred task, focus rings.
  On dark it lifts to a warmer, brighter orange rather than shifting hue.
- **Ember Wash** (`accent-bg`): the low, warm tint behind the active dock tab —
  the one place a background carries state. Never a border, never text.
- **Ember Deep** (`accent-ink`): the orange darkened enough to be read as small
  text, and the ink of the active dock tab.

### Neutral

- **Neutral Fifty** (`bg`): the ground. `#fafafa`, never pure white; on dark a
  warm near-black that is closer to brown than to blue.
- **Paper** (`surface`): cards, dialogs, the dock capsule, and the punched
  centre of a ring. On light it is the only true white in the system.
- **Ash** (`surface-2`): the second layer — the tab group's trough, the day
  tape's empty track, the unfilled arc of a ring, a skeleton bar.
- **Stone** (`ink`): primary text, the primary button's fill, the now-mark.
- **Stone Muted** (`ink-2`) → **Stone Quiet** (`ink-3`) → **Stone Faint**
  (`ink-4`): the descending ladder. `ink-4` is where a headline's subject and a
  finished task's title go — present, deliberately receded.
- **Hairline** (`line`) and **Hairline Strong** (`line-strong`): the 1px rules
  that do the structural dividing. `line` separates rows within a list;
  `line-strong` bounds cards, chips, chevrons, and an unset checkbox.

### Tertiary

- **The domain palette** (`domain-*`): nine slots — Clay, Yellow, Green, Teal,
  Cyan, Blue, Indigo, Orchid, Rose. They are **not** part of the chrome. Six of
  them were chosen: Green, Blue and Indigo are Apple's system colours, Yellow is
  Apple's `#FFCC00`, and Orchid and Rose are ours. The other three were computed
  to fill what those six left open — Clay as the one low-chroma slot, so a domain
  can be quiet without going grey, and Teal and Cyan across the 110° hole between
  Green (h147) and Blue (h257), which would otherwise split the set into two
  clusters and show on the day tape as a seam.
  All nine are then measured against three floors, met in both themes: ΔEok ≥
  0.12 between any two, because a domain's smallest form is a 9px dot (worst
  0.128); ΔEok ≥ 0.15 from the accent and the priority ring, because mistaking a
  domain for a *state* is worse than mistaking two domains (worst 0.159); and ≥
  3:1 against their own ground (worst 3.03:1). Hue is shared across themes —
  only lightness and chroma may differ, never hue.
  **Travel is the one exemption, on purpose.** A full yellow is 1.45:1 on the
  light ground and the brightest yellow clearing 3:1 is a mustard, so brightness
  won. In dark it is 12.53:1. Do not "fix" it.
- **The priority ramp** (`priority-high`, `priority-med`): one red at three
  intensities — solid with a halo, the same red at 42%, then the plain grey
  rule. Not three hues: the domain dots already own the wheel, and a third hue
  would collide with Travel's yellow.

### Named Rules

**The One Orange Rule.** The accent means "this needs you" and nothing else.
Overdue, late, starred, focused. It is never a decoration, never a heading
colour, and never used to make a section look important. If two things on a
screen are orange for different reasons, one of them is wrong.

**The Measured Palette Rule.** Domain colours are data. They are generated and
measured in `.impeccable/mocks/palette-lab.html` against the three floors above.
Retune them in the lab and re-measure, or not at all — never by hand, and never
one at a time.

**The Stored Slug Rule.** A domain's colour is stored as a palette slug
(`health`), never as a hex. A stored hex cannot theme-switch, and dark is a full
peer. Anything rendering a domain colour resolves it through
`var(--domain-<slug>)`.

**The Recorded Contrast Tradeoff.** `ink-3` (3.3:1) and `ink-4` (2.0:1) miss
WCAG AA at 12px on paper. That is the pinned palette and a recorded decision —
fidelity over the contrast floor. It affects the tape's ruler, `meta` counts,
and the quote's actions. Do not "fix" it locally; reversing it is a darkening of
two tokens here, which lands on every surface at once.

## Typography

**Display Font:** Geist Sans (with Arial, ui-sans-serif)
**Body Font:** Geist Sans (the same family; there is only one)
**Label/Mono Font:** Geist Mono (with ui-monospace, SFMono-Regular, Menlo)

**Character:** One family working across two registers — a tight, large,
500-weight sans for anything a human named, and an uppercase mono eyebrow for
anything the system labelled. The split does most of the hierarchical work, so a
section heading can sit at body size and still read as a heading.

### Hierarchy

- **Hero** (500, 56px, 1.04, −1.4px): Today's headline on desktop, and nothing
  else. Steps to 36px on a phone on the same ramp.
- **Display** (500, 44px, 1.08, −1.1px): available on the ramp; currently
  unspent.
- **Headline** (500, 36px, 1.1, −0.9px): a page's `h1`, and Today's headline at
  phone width.
- **Title** (500, 30px, 1.15, −0.75px): a section title large enough to open a
  page region.
- **Lead** (400, 18px, 1.7): a pull-quote, standfirst copy, and an authored
  prose `h2` inside a note body (Pass 3).
- **Body** (400, 16px, 1.5–1.6, −0.01em): every row title, every task, every
  list, and long-form prose (note body, chat message, journal entry).
- **Section** (500, 16px, −0.02em): a section heading, and an authored prose
  `h3` inside a note body. Same size as body — the weight step is the entire
  signal, which is why it is enough.
- **Small** (400, 14px): a chip, a pill's label, a supporting line.
- **Meta** (mono, 400, 12px): clock times, counts, streaks, ruler hours.
- **Eyebrow** (mono, 400, 12px, 0.1em, uppercase): the dateline, `ALL DAY`, a
  bucket name — anything the system labelled rather than a person.
- **Micro** (mono, 400, 11px, 0.08em): the one step below the ramp, and the
  only place the ramp is broken. It exists in exactly three sites, all of them
  mono labels under density pressure that 12px measurably loses: the day tape's
  per-block start times, the tape's ruler at phone width, and the dock's five
  tab labels at 375pt.

### Named Rules

**The Two Weights Rule.** 400 and 500. There is no 600 and no bold. If
something is not standing out enough, it needs to be bigger, in a different
colour, or in the mono register — never heavier.

**Row names rest at 400.** Pass 2 Gate A (`.impeccable/mocks/lists-lab.html`,
option A1). Every list-row name is body size at 400 — project, person, note,
routine, quote, link, notification, task. Hierarchy on a list comes from
colour, position, and the mono meta, not from weight. The system's only weight
step is reserved for the things that earn it: **P1 on a task** (the one step
to 500), a `SectionHead`, a page title. `rowTitle()` on `ListRow` is the
row-name class. `.type-title` was retired in Pass 5 — below-ramp titles inline
`font-medium tracking-tight` rather than a class that had three meanings.

**The Named vs Labelled Rule.** If a person wrote it, it is sans. If the system
labelled it, it is uppercase mono. A row's title is sans; the time beside it is
mono. This is why the page reads as two columns of meaning without any rules
being drawn.

**The Eyebrow Never Crowns Rule.** The uppercase mono eyebrow labels a region —
a dateline, `ALL DAY`, a bucket name, a card's section label. It never sits
above a heading. Stacked over an `h1` it names the same thing twice in two
voices, and that stack was the legacy silhouette every page wore before
ADR-0042.

**The Tabular Rule.** Every number that can change under the reader — a clock,
a count, a streak, a percentage — is `tabular-nums`. Digits that reflow while
you look at them are a defect.

**The Closed Ramp Rule.** 56/44/36/30/18/16/14/12, plus `micro` at 11px in the
three sites named above. That is the whole ramp. A fourth 11px site, or any
new size at all, is a signal that a layout is too dense — fix the layout, do
not invent a step. If a new step is genuinely warranted, it lands here first
and in the code second.

**The Prose Measure Rule.** Long-form reading and writing — a note body, a
chat message, a journal entry — is capped at **`65ch`**
(`--measure-prose` / `.measure-prose`). A list is not prose: rows keep the full
frame. Pass 3 Gate W2 (`.impeccable/mocks/writing-lab.html`). The previous
state ran the note body to the full 72rem frame (~150 characters per line);
`max-w-prose` appeared only on chat's assistant and a few link rows. One token
owns the measure so a later package (centred, slightly wider) is a token change
and a title step, not a rewrite of three surfaces. Body stays 16 either way.

**Authored prose is on the ramp.** A note's headings are content, not chrome —
`#` in a markdown body is the writer's hierarchy, spent on existing steps
rather than inventing 24/20. The note title is **Title** (30/500). In-body
`h1` is Title (30/500), `h2` is Lead size at 500 (18), `h3` is Section
(16/500). Body is Body (16/400, 1.6). `.prose-authored` is the class; the
comment that once claimed "serif headings" is gone with the serif.

**Speaker registers in chat.** A person wrote the user message → sans body at
400, right-aligned, `ink-2`. The assistant's answer is running prose → sans
body at 400, left-aligned, full `ink`, on the measure. Distinction is
alignment + ink step, never mono-for-person / weight-for-machine.

## Layout

The shell owns the viewport: the document never scrolls, the content region
inside it does (ADR-0028). Installed on iOS the shell height is measured in JS
rather than trusted to a viewport unit.

The page frame is centred at `max-width: 72rem` with 44px of horizontal padding
on desktop and 20px on a phone, and it carries the header at the top with 64px
beneath it before a page's own content begins.

Today's stack is **one tree, two compositions.** Desktop is a `1.5fr / 1fr`
grid with 40px between columns: Timeline, Open and the quote on the left; Top 3,
Routines and Projects on the right. Below `64rem` the two column wrappers
dissolve via `display: contents` and `order` re-sequences the same sections into
one column, orientation-first — Top 3 and Routines rise above the long lists,
because the phone is where things get ticked off. There is no separate mobile
component tree and there must never be one.

The note editor (`/notes/[id]`) is **column + rail** (Pass 3 / W2). The prose
column is left-aligned on the measure; Backlinks and Linked take a **260px
right rail** on desktop and stack below on a phone — same tree, one max-width
query. The leftover width of the 72rem frame is the rail, not empty ground.
The rail collapses when a section has nothing to show (no empty furniture).

Vertical rhythm is one band for page sections (Pass 4.5 Gate B / option 1):

- **16px** between stacked cards inside a section
- **36px** (`mt-9`) between peer sections — list groups, detail blocks, settings
  chunks. One number; detail pages do not breathe more than list pages.
- **64px** under the **app** header (`AppHeader`'s `mb-16`) before a page's own
  content begins. That is not `PageHeader`'s bottom margin — the page header
  adds its own ~28px (`mb-[26px] lg:mb-[30px]`) under the title line.
- The first section after `PageHeader` carries no top margin; the header already
  owns that gap (`first:mt-0` on list stacks).

Rows are ≥48px on touch and every checkbox carries a 44px hit slug it does not
draw. Today's internal grid (40px column gap, day-tape spacing) is its own
composition and is not this rule.

### Named Rules

**The One Tree Rule.** A phone layout is a max-width query beside its desktop
peer, plus `display: contents` and `order`. If a `<MobileX>` component is being
written, the layout is wrong.

**The Invisible Slot Rule.** A control that appears conditionally holds its slot
with `visibility`, not `display`, so its neighbours never shift. The day nav's
Today reset is the canonical case.

## Elevation & Depth

Mostly flat, lifted rarely, and the lift is warm. Depth is carried by a soft
two-part shadow on the few things that genuinely float — cards, dialogs, the
active tab in its trough, the dock — over a hairline-and-tone system that does
everything else. On dark the shadows go black and deepen rather than inverting
to a glow.

### Shadow Vocabulary

- **Card lift** (`0 1px 2px rgba(41,37,36,0.04), 0 10px 28px rgba(41,37,36,0.05)`):
  cards, panels, and the active tab pill. Barely there by design — enough to
  separate paper from ground, not enough to read as a stack.
- **Overlay lift** (`0 2px 6px rgba(41,37,36,0.06), 0 14px 34px rgba(41,37,36,0.16)`):
  dialogs and the dock. Deeper on purpose: the dock floats over white cards and
  has to stay a separate object while it does.
- **Priority halo** (`0 0 0 3.5px var(--priority-high-halo)`): not depth at all
  — a ring of colour around a high-priority checkbox. The only shadow in the
  system carrying meaning rather than height.

### Named Rules

**The Warm Shadow Rule.** Shadows are cast in `rgba(41,37,36,…)`, not in black.
A neutral shadow on a warm ground reads as dirt.

## Shapes

Large and soft, with one hard exception. Cards are 22px, controls and chips are
12px, and anything a thumb reaches for is a full pill — the header's tabs, the
Ask and Capture buttons, the day-nav chevrons, the dock and its capsules. The
checkbox is a 7px squircle at 19px, which is the shape most repeated on the page
and the reason `mark` exists as its own step. Fields are the exception: they
have no radius at all, because they are a single bottom rule rather than a box.

Two shapes carry meaning outright. On the day tape an **event is a filled block**
spanning its duration and a **scheduled task is an outlined tick**, because a
task is a point in time rather than a span — the shape is what tells you which
is which, and the colour then tells you whose. In a list, an event takes a
calendar glyph in the same 19px column a task's checkbox occupies, which is what
says "this is not yours to tick".

### Named Rules

**The Shape-Then-Colour Rule.** Shape distinguishes *kinds*; colour
distinguishes *instances*. Colour is never the only thing separating two things
that behave differently.

## Components

### Page Header

Every surface but Today and the note editor opens with it. Slots in one line
where there is room — **title · facts · measure · action** — with a subtitle
beneath where one is earned (ADR-0042; Pass 4.5 Gate A for facts).

- **Title:** the ramp's Headline step, 36px / 500 / −0.9px, dropping to 30px on
  a phone. One step below Today's hero, so a list page can never out-shout the
  day.
- **Facts:** plain attribute readings on the title's baseline — type, status,
  relationship, company — at 14px / 400 in `ink-3`, no tabular-nums. Sit
  **before** the measure. Used when a detail page needs identity on the header
  without abusing the count treatment (Pass 4.5 Gate A / option A).
- **Measure:** the page's own **count** reading — `14 open`, `3 paused`,
  `3/8 milestones` — figure at 500 in `ink-2` with tabular-nums, word at 400 in
  `ink-3`, both at 14px. It takes the accent only for what is genuinely late,
  never to mark that a count is non-zero. Never a plain attribute with an empty
  label.
- **Action:** one standing control, centred against the title's baseline.
  On an object list this is where create lives — labelled `+ New …`, the notes
  pattern (Pass 2 Gate B / B1). `/tasks` is the exception: a bare `+` on the
  title's shoulder (`NewTaskButton` in the same `action` slot), because a second
  labelled create next to Capture was the confusion ADR-0043 removed.
- **Subtitle:** only where it carries an instruction. Not a tagline.
- **No divider, no eyebrow, no second title.** The 64px the shell puts above the
  header is the separation.

Three deliberate exceptions decline it:

- **Today:** its `h1` is a sentence about the day and its dateline is the day
  nav.
- **The note editor** (`/notes/[id]`): the note's name is editable content and
  cannot live in a static header. A mono breadcrumb (`← Notes`) is the way
  back; the title input is the page's name.
- **`/sign-in` and the root 404:** outside the app shell. Brand mark + wordmark
  introduce the product; a Title-step h1 names the page. No mono eyebrow, no
  hairline (Pass 5 / B).

### Failure and absence

Three edge registers, settled in Pass 5 (ADR-0048; gate `edges-lab.html` B):

- **Broken (fault):** `PageHeader` + operational English + primary recovery.
  Raw errors stay in the console, never in the UI.
- **Broken (missing):** `PageHeader` + quiet nav. No error colour — missing is
  not a crash.
- **Absent:** `EmptyState` — left-aligned italic, upright hint. A slot inside
  a page, never a page itself.
- **Waiting:** `PageSkeleton` on routes; content-shaped pulses on the note
  editor (no header to hold). Waiting is geometry, not copy and not fault.

The toaster is a surface card (medium title, error border) and defaults to
light, matching `THEME_BOOT`.

### List rows

`ListRow` carries only geometry: hairline, `min-h-12`, `py-3`, `gap-3`, and the
leading / body / trailing columns. Rows keep their own composition — a
`variant` prop per surface is the failure mode. `className` is the sanctioned
hatch for **state** (pending, selected), not for inventing a second row type.

- **Domain leads left** and holds its slot when absent (Invisible Slot Rule).
  One colour meaning per row: a project's own colour is not a second dot on
  the list (it may appear on the detail header).
- **Name at 400** via `rowTitle()`. Its `tone` / `emphasis` variants carry the
  done and P1 cases, so a row never appends a colour by hand. See Two Weights
  above.
- **Group labels** are `SectionHead` (16px / 500), not the mono eyebrow.

### Creating an object

**A list of objects opens as a list.** Creating an object is one action on the
page header; the form is a dialog. Standing `CollapsibleForm` furniture above
the first row is gone from `/projects`, `/people`, `/quotes`, `/routines`,
`/domains` (Pass 2 Gate B / B1; ADR-0043 generalised; domains joined in Pass 4).
`/journal` is the exception that proves the rule: writing the entry *is* the
page, so standing furniture is correct there — Pass 3 applies it.

### Empty States

A list with nothing in it says so in words rather than collapsing. Left-aligned
on the same edge as the rows it stands in for, `text-base` italic at `ink-3`,
with an optional upright hint beneath in `ink-4` — the roman is what says the
hint is an instruction rather than more of the sentence. Inside a card, where
the empty stands in a row's position, it keeps the row's bottom hairline.

This is the only italic in the chrome, and it is what separates a sentence the
app is saying from a title a person wrote.

### Buttons

Two voices, and they are not interchangeable.

- **Pill** — sans, sentence case, 14px at 500, fully rounded, 40px tall. The
  primary voice, and it is spent only on the shell's two standing actions
  (Ask and Capture) and the day nav's Today reset.
  - **Primary:** ink fill, ground-coloured label. Capture, because capture is
    the one action the whole product exists to make cheap.
  - **Outline:** transparent on a `line-strong` hairline, full-ink label.
- **Control** — mono, uppercase, 12px, 12px radius, 36px tall. The quiet voice
  the rest of the app is built from: row actions, form buttons, filters.
- **Hover / Focus:** colour only — a border darkens, a label steps up the ink
  ladder. Nothing moves. Focus is a 2px accent outline at 2px offset, applied
  globally and never removed without replacement.
- **Pending:** an optimistic mutation in flight dims its own subtree to 50%
  (`opacity-50`) and nothing else moves — no skeleton swap, no spinner, no
  layout shift. `Button.isPending` is the canonical instance; the same dim
  applies via `className` on a wrapping div or a `ListRow` when the whole
  block is the unit in flight. One language, three call sites — not three
  treatments.

### Chips

- **Style:** 12px radius on a `line-strong` hairline, transparent fill, full-ink
  label, with a 7–9px domain dot leading. 30px tall.
- **State:** the all-day band's chips are stateless labels. They wrap rather
  than scroll — a hidden chip is a missed commitment.

### Cards / Containers

- **Corner Style:** 22px — the largest radius in the system.
- **Background:** paper on ground.
- **Shadow Strategy:** card lift (see Elevation).
- **Border:** a 1px `line` hairline, which is what keeps the card visible on
  dark where the shadow cannot do it alone.
- **Internal Padding:** 22px vertical, 24px horizontal.

### Inputs / Fields

- **Style:** no box and no radius — a transparent field over a single 1px
  bottom rule.
- **Focus:** the global 2px accent outline.
- **Empty:** native date/time skeletons dim to `ink-4` so an unset field does
  not read as filled.

### Navigation

- **Desktop:** a segmented pill group in an `surface-2` trough. The active tab
  lifts onto paper at weight 500 with the card shadow; the rest sit at `ink-3`
  in the same 14px sans. The group sits centred in a header that scrolls with
  the page rather than pinning.
- **Mobile:** the same tabs move to a floating dock. The active tab takes the
  ember wash with ember-deep ink in 11px uppercase mono; capture sits beside it
  as a square ink capsule with a Lucide `Plus`. Two signals that can never be
  read as one — **the tab takes the accent, the action takes ink.**
- **More is a menu, not a page** (Pass 4 / C4, ADR-0045). Destinations only
  (Daily / Library / System). Desk: popover under the tab group. Phone: sheet
  above the dock. Account chrome lives on `/settings`. More stays lit for every
  destination it hosts (A1), so the coarse locator still answers on Projects,
  Domains, Settings, etc.
- **`/domains` is a Library page** — object list under the same rules as
  Projects and People, not a settings section.

### The Day Tape (signature)

A proportional measure of one day, pinned at **06:00–22:00**. Committed time is
a filled block in its own colour, free time is empty, and the now-mark is a 2px
ink rule carrying its own hour in 500-weight mono.

The window is pinned rather than fitted to the day's contents: a window that
shrinks to what happens to be scheduled makes a 30-minute meeting a different
width every morning, and a proportion you cannot compare between days measures
nothing. It only widens, and only to contain something outside it.

**Titles never go inside the blocks.** At 1092px the tape runs 1.14px per
minute, so a 30-minute meeting gets 34px against the 141px its title needs; at
393pt it is 11px. Start times ride above the track on desktop and go entirely on
a phone, where the ruler thins to its two ends plus the now-mark. Every title is
in the Timeline list directly below, which was always the tape's contract.

Three collision rules keep it readable and all three resolve in favour of the
reading that changes: a start label gives way to the one before it, and any
ruler hour gives way to the now-label and to the closing hour.

The tape is capped from above by the **all-day band** — everything that belongs
to the day but has no hour, which is precisely what the tape is structurally
incapable of showing. The two read as one object for exactly that reason. When
there is nothing all-day the band is absent, not empty.

**Motion:** the tape is the one authored moment. Blocks wipe out from their own
start edge in clock order, and the now-mark drops in last. The resting state is
the default and the whole thing sits behind `prefers-reduced-motion:
no-preference`.

### Progress (signature)

One completion figure with two renderings — a conic `ring` with an opaque
punched centre that carries its own reading, and a flat `bar`. Which one draws
is not a per-call-site choice: it comes from `TODAY_VARIANT` in
`lib/ui/variant.ts`, the single flag that separates the two designed Today
compositions. Reverting the whole page from rings to bars is one line there.

## Do's and Don'ts

### Do:

- **Do** use size, colour, or the mono register to create hierarchy. Weight is
  not available: the ramp stops at 500.
- **Do** resolve a domain colour through `var(--domain-<slug>)` from the stored
  slug. Never write a domain hex into a component.
- **Do** pair colour with a shape or a word whenever it carries meaning — an
  outlined tick versus a filled block, a `6d late` label beside the orange.
- **Do** hold a conditional control's slot with `visibility` so its neighbours
  never shift.
- **Do** write a phone layout as a max-width query beside its desktop peer, and
  reorder with `display: contents` + `order`.
- **Do** give every number that can change under the reader `tabular-nums`.
- **Do** let an empty band say so in words. Absent, never empty; a placeholder,
  never a collapse.
- **Do** cast shadows in `rgba(41,37,36,…)` on light.

### Don't:

- **Don't** introduce a second accent, or spend the orange on anything that is
  not "this needs you". Its rarity is the entire signal.
- **Don't** retune a domain colour by hand. Change it in
  `.impeccable/mocks/palette-lab.html`, re-measure against the three floors, or
  leave it alone.
- **Don't** "fix" the `ink-3` / `ink-4` contrast locally. It is a recorded
  tradeoff; reversing it is a change to two tokens in the theme.
- **Don't** put a title inside a day-tape block. There is no width for it at
  either breakpoint, and the Timeline below already carries it.
- **Don't** fork a component for the phone. If a `<MobileX>` is being written,
  the layout is wrong.
- **Don't** spend the pill voice on ordinary controls. Two standing actions and
  the Today reset; everything else is the mono control.
- **Don't** move anything on hover. Hover is a colour change.
- **Don't** draw a ring at 0% for something with nothing to measure — that is
  furniture, not a reading.
- **Don't** give a page a second title under its name. The header names it once;
  a display line that renames it is a mood, not information.
- **Don't** restate a page header inside its `loading.tsx`. Render the real one
  through `PageSkeleton` — a page's name is not data, and a hand-copied header
  drifts the moment the real one changes.
- **Don't** put a figure in the measure slot that the page cannot stand behind.
  A count that flips client-side belongs with the thing that owns it, and a
  placeholder count is the one thing on a loading screen that lies.
