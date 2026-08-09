# Design comps

Comps for the Today refactor and the passes that follow it. Throwaway HTML, not
app code — the shared world lives in `_a.css`, and each `*.standalone.html`
inlines it so the file opens anywhere.

Serve them with `bun run` — or the `mocks` entry in `.claude/launch.json`
(`python3 -m http.server 4500 --directory .impeccable/mocks`).

## The build

**A2 — Ring**, light theme. `today-a2-ring.html`

## Files

| File | What it shows |
|---|---|
| `today-a2-ring.html` | **The build.** Light, a full working day. |
| `today-a2-ring-dark.html` | Same, `data-theme="dark"`. |
| `today-a2-ring-quiet.html` | Empty-day states. |
| `today-a2-ring-mobile.html` | **The build, on a phone.** Same day at 393pt. |
| `today-a2-ring-mobile-dark.html` | Same, `data-theme="dark"`. |
| `today-a2-ring-mobile-quiet.html` | Empty-day states at phone width. |
| `today-a2-ring-mobile-otherday.html` | The day nav in use: Friday, no now-mark, Today reset showing. |
| `today-a1-rail.html` | The alternate. Light. |
| `today-a1-rail-dark.html` | Alternate, dark. |
| `today-a1-rail-quiet.html` | Alternate, empty states. |
| `palette-lab.html` | **The domain palette**, with the measurements that justify it. |
| `tape-lab.html` | Why the day tape carries no event titles — measured against a real day. |
| `chrome-header-lab.html` | **Pass 0.** The page header, four ways, over `/projects`, `/notes` and `/inbox`. Theme and width toggle in place. |
| `tasks-lab.html` | **Pass 1.** `/tasks` whole, three ways, over the one seam Pass 0 left open. Theme and width toggle in place. |
| `lists-lab.html` | **Pass 2 Phase 0.** The two gates: name weight (A1/A2) and create furniture (B1/B2). `/projects` and `/people` side by side under each option. Theme and width toggle in place. |
| `writing-lab.html` | **Pass 3 Phase 0.** One gate, three packages: measure + type scale + leftover width. `/notes/[id]` and `/chat` under each. Theme, width, and measure-guide toggles. |
| `config-lab.html` | **Pass 4 Phase 0.** Gate closed on **C4**: `/domains` Library page · `/settings` knobs + account · More is a menu (not a route). Theme and width toggle. |
| `system-lab.html` | **Pass 4.5 Phase 0.** Two gates: measure vs facts on the page header (A/B), and section rhythm (doc band vs named three-tier vs PageBody). `/projects/[id]`, `/people/[id]`, `/domains`. Theme and width toggle. |
| `edges-lab.html` | **Pass 5 Phase 0.** Edge register gate: waiting · absent · broken. Four failure surfaces + EmptyState + PageSkeleton + note Suspense fallbacks under A/B/C. Theme and width toggle. |

## The page header (Pass 0)

`chrome-header-lab.html` is the decision surface for the one piece of real
design in the shared-chrome pass. Twelve surfaces repeat one header and Today
cannot answer what replaces it — Today has no page header at all.

One measured fact reframes the question the brief asked. The desktop tab group
has five tabs (Today / Tasks / Notes / Links / More) and **eight of the twelve
pages sit behind More**, so on `/projects` the active pill says "More", which
names nothing. The tab group is a coarse locator and the page header is the fine
one; the header is not redundant on desktop, and the desktop/phone asymmetry the
brief anticipated does not exist. What is open is only **how much room the page
name gets**, and the three options move along that one axis.

| | Title | Measure | Divider |
|---|---|---|---|
| **D — Headline, measured** ← chosen | 36px sans, 30px on phone | on the title's baseline, Today's counters idiom | none |
| A — Headline | 36px sans, 30px on phone | quiet line beneath | none |
| B — Measured | 30px sans, unchanged on phone | on the title's baseline | 1px `--line` |
| C — Label bar | mono 12 uppercase, the whole header is one bar | inline, mono 12 | 1px `--line` |

**D is the build.** A, B and C are the three the axis was drawn with and stay
as the record; D is A's 36px headline with B's measure moved onto its baseline
and B's hairline dropped — the 64px the shell already puts above the header is
the separation, and the rule was the last piece of the legacy silhouette still
standing. At 393pt the title keeps its own line and the measure and action take
the one below.

All three carry the same four slots — **title · measure · subtitle · action** —
and two decisions are constant across them, so neither is being voted on: the
linen-era second title ("What's in motion", "Loose thoughts") is gone, and the
eyebrow never sits above a heading again. It stays alive everywhere it is a
system label; the *stack* is what this pass deletes.

The bodies are drawn as Pass 0 will actually leave them — the legacy
composition minus `font-serif` — because passes 2–4 are what redesign them.
That is deliberate: it is what exposes C's collision, where the page title
`PROJECTS` and the group label `ACTIVE` are the same 12px mono a few pixels
apart, separated only by `ink` against `ink-4`.

One consequence is recorded here rather than built: `/projects` has no trailing
action in these comps because its create form sits open at the top of the page,
and **that form becomes a dialog in Pass 2**. When it does, `/projects` gains a
`+ New project` action in exactly the slot `/notes` already uses. The header
does not change shape for it — which is the point of it being a slot.

## The Tasks page (Pass 1)

`tasks-lab.html` is the decision surface for the seam ADR-0042 recorded and did
not close. `PageHeader`'s measure slot carries a page's own reading, and on
eleven surfaces that reading is informational. On `/tasks` the same phrase
already exists and **it is the status filter** — `TaskStatusStrip` renders
`open · overdue · today` with counts, and pressing a count narrows the list.

One correction to the brief that opened this: the measure is **sans 14**, not
mono; the strip is **mono 12**. They were never the same typeface. What they
share is the slot and the shape of the phrase, which is enough.

| | Status filter | Measure slot | Active mark |
|---|---|---|---|
| **T2 — Filter bar, as it ships** ← built | mono 12 text on a bar | unused | ink + 2px **neutral** rule |
| T4 — Filter column | right, on the title's baseline; scope beneath it | *is* the right column | ink + neutral rule, or the lift |
| T3 — Segmented control | trough + three cells, mono 12 uppercase, 36px | unused | paper + card lift |
| T1 — Measure made interactive | in the measure slot, sans 14 | *is* the filter | ink + 2px accent underline |

**T2 is what shipped**, with one change carried over from the argument against
it: the active mark is a neutral rule rather than an accent underline, so the
orange on that bar means only "this is late". T4 was drawn at the owner's
proposal and read better in theory than on screen. T3 was the recommendation
and lost on volume — it is a filled object where the page had only text.

Two things landed with it that the comps do not show, both from the owner
mid-build: the standing capture line is gone in favour of a bare `+` beside the
page's name (ADR-0043), and the star is hollow until a row is pinned.

**T4 reframes the question and is drawn first.** T1–T3 all argue about which
slot the status counts belong in and leave the inbox link where it was — a
mono-12 accent link parked below a bar of filters, reading like a fourth filter.
T4 asks instead what each control *is*, and splits the header block by kind:
everything that names the page or acts on it goes left, everything that filters
it goes right, in two rows on a shared grid. The inbox link — the one control
there that navigates rather than narrows — takes the subtitle's position under
the page's name. The measure-slot question then dissolves: the right column *is*
the measure slot, widened to hold what this page actually keeps there.

T4 is a **placement, not a voice**, so it is drawn twice: once with the strip
(active count marked by the ink ladder and a neutral rule) and once with T3's
segmented control in the same slot. A third frame shows the common case with an
empty inbox.

**The accent is the argument against T1 and T2.** In both, the orange says two
things on one line — *you are here* (the active underline) and *this is late* (a
non-zero overdue count). That is precisely the case the One Orange Rule forbids.
T3 and both T4 variants mark the active state without the accent, so the orange
on that row only ever means late.

T1's cost shows at 393pt: the header wraps its right cluster to a second row, so
the order becomes title → status → scope, which is T2's layout with a wider gap.
Whatever T1 wins, it wins on desktop only.

The page body is **identical in all four** — capture line, groups, rows. Three
row-level changes are drawn there and are settled rather than voted on: the
priority ring replaces the P1–P4 badge, the 9px domain dot moves into the left
column beside the mark (holding its slot when a task is unfiled), and the title
drops to 400 with P1 the one step up — all three converging on Today.

The star is hollow at `ink-4` by default and fills in the accent only for a row
already pinned to today's Top 3. Hollow is the affordance: an unstarred row is
offering the slot.

## The list family (Pass 2 Phase 0)

`lists-lab.html` is the decision surface for the two questions Pass 1 answered
only for `/tasks`. Eight list surfaces are about to be written either way, so
both are closed here before any row is extracted.

| | Name weight | Create furniture |
|---|---|---|
| **A1 — Rest** | every row name **400**; P1 (tasks only) still steps to 500 | held at B1 |
| A2 — Exception | object names stay **500**; tasks are the special case | held at B1 |
| **B1 — Write behind the header** | held at 400 | standing `CollapsibleForm` gone; labelled `+ New …` in the action slot (notes pattern) |
| B2 — Standing form stays | held at 400 | form open above the list (the expensive state) |
| B1·∅ | held at 400 | empty state under B1 |

**Chosen: A1 + B1.** Built in Pass 2. The Two Weights Rule generalises; every
row name is 400 (`ROW_TITLE_CLASS`). Object-create lists follow ADR-0043’s move
of the form into a dialog behind a labelled `+ New …` in the action slot.
`/journal` is not an object-list — writing the entry *is* the page — so standing
furniture stays there; Pass 3 applies that half of the rule.

`/projects` was already recorded in the Pass 0 comps as gaining a create action
in the notes slot; B1 is that shape built. Encoding not on the ballot and also
built: domain leads left and holds its slot; a project’s own colour is not a
second dot on the row; group labels are `SectionHead` at 16/500.

## The writing surfaces (Pass 3 Phase 0)

`writing-lab.html` is the decision surface for the first questions the design
system has never answered about prose: how wide a line may be, which ramp steps
the editor spends, and what a 72rem frame does with leftover width when the
content is a column rather than a row.

One gate, three packages — measure + type + leftover layout travel together.
`/notes/[id]` and `/chat` are drawn under each. Theme, desk/phone, and a dashed
measure guide toggle in place.

| | Measure | Type | Leftover width |
|---|---|---|---|
| W1 — Column left | 65ch left | title 30 · body 16 · h2 18 · h3 16 | empty ground |
| **W2 — Column + rail** ← chosen | 65ch left | identical to W1 | backlinks / Linked as right rail |
| W3 — Reading lead | 72ch centred | title 36 · body 18 · h2 30 · h3 18 | balanced ground |

**Chosen: W2.** Built in Pass 3. Measure is `--measure-prose: 65ch`; authored
prose is `.prose-authored` on the closed ramp; the note page is column + 260px
rail. A possible later package — W3’s centred wider column **with body still
16** — is a token + title-step change, not a third scale.

Held off the ballot and drawn the same in every package: the breadcrumb is the
editor’s header (editable title cannot sit in `PageHeader`); chat keeps its
page header; chat speaker distinction is alignment + ink step at body 400 — not
the current mono/title inversion; panel names rest at 400 with `SectionHead`
labels; no new ramp sizes (the undocumented 24/20 leave everywhere).

Phases 1–4 in `.impeccable/BUILD-WRITING.md`.

## The configuration surfaces (Pass 4 Phase 0)

`config-lab.html` is the decision surface for what remains after domains leave
`/settings`. Domains becoming a Library page is **settled** (owner decision;
supersedes ADR-0011’s domain half).

**Chosen: C4.** More is chrome, not a page. Phone sheet settled.

| | What |
|---|---|
| **`/domains`** | Library object list (ADR-0044) |
| **`/settings`** | Knobs + account (theme, email, sign out). Options grow here. |
| **More** | Menu only. Destinations only. **No `/more` route.** No rail on desk — header tabs only. |

**Forks closed:** **A1** (More lit on hosted destinations while menu closed) ·
**B1** (desk popover under the tab group). Phone sheet settled earlier.

Phases 1–4 in `.impeccable/BUILD-CONFIG.md`. Lab misalignments get fixed in the
build, not another lab polish loop.

## The system pass (Pass 4.5 Phase 0)

`system-lab.html` is the decision surface for two questions that are not
route-scoped: what the header measure may carry, and what the vertical rhythm
between sections actually is.

| | Measure / facts | Section rhythm |
|---|---|---|
| **A** | `PageHeader` gains plain `facts` (ink-3, no tabular-nums) beside counts | — |
| **B** | Measure keeps only real counts; attributes live in Details | — |
| **1** | — | Doc wins: 36px between every section |
| **2** | — | Code wins, named: 32 list / 56 major detail / 24 tight |
| **3** | — | Delivery: `PageBody` owns gap; pairs with 1 or 2 |

As-shipped frames (A0 / B0) are drawn first so the defect is visible, not only
described.

**Chosen: A + 1.** Built after Phase 0. `PageHeader.facts` carries plain
attributes before the count measure; section stacks normalise to **36px**
(`mt-9`). Option 3 (`PageBody`) was not taken.

Phases in `.impeccable/BUILD-SYSTEM.md`. Decided without a gate: More menu
desktop `max-h` reset, pending-dimming rule in `DESIGN.md`, two efficiency
leave-alones.

## A1 vs A2 — one axis

The two differ only in how **progress and priority** are drawn. Everything
else — header, day tape, timeline, Top 3, streak trails, quote card, empty
states, late labels — is identical.

| | A1 — Rail | A2 — Ring |
|---|---|---|
| Task priority | left rail; height + opacity encode P1/P2/P3 | ring on the checkbox; high adds a halo, title steps to 500 |
| Routines progress | horizontal bar | completion ring (`5/8`) |
| Project progress | bar per row | conic ring per row |
| Legend | three rail heights | three ring swatches |

When this is built, keep the difference as **one variant flag over a shared
`Progress` primitive** with `bar | ring` renderings. Switching back to A1 should
be a flag, never a redesign.

## Themes

Light is the default. Dark is the same tokens under
`[data-theme="dark"]` in `_a.css` — no forked components, no separate stylesheet.

## Phone

`_m.css` layers on `_a.css` and carries only what 393pt forces to change. Open a
mobile comp on a desktop browser and it renders inside a 393×852 device with
emulated safe-area insets; open it on a phone (≤460px) and the frame drops away
and it goes edge to edge. Same markup, two presentations.

Four things change, and nothing else does:

1. **`h1` steps 56 → 36** on the pinned ramp. It still breaks on the em-dash.
2. **The day tape becomes a glance strip.** At 0.37px per minute the per-block
   start times above the track would overlap two-deep, so they go; the ruler
   keeps `06:00 · now · 18:00 · 22:00` and the now-mark keeps its own hour. The
   percentages are the desktop arithmetic untouched. Every time and title is in
   the Timeline directly below — which was already the tape's contract.
3. **Two columns become one**, ordered orientation-first: headline → tape →
   Top 3 → Timeline → Open → Routines → Projects → Resurfaced. Top 3 and
   Routines sit above the long lists because the phone is where they get ticked.
4. **Tabs leave the header for the dock**, and capture becomes the dock's
   action. The date moves into the app bar, so it stays visible after the
   headline scrolls away.

At build time this is **one responsive tree, not a fork**: every rule in
`_m.css` belongs under a max-width query beside its desktop peer, and the stack
order is `display: contents` + `order` over the same sections. `_m.css` is a
separate file here only so the locked desktop comps stay byte-identical.

Touch: rows are ≥48px and every checkbox carries a 44px hit slug via
`.check::before`, which the desktop comps do not need.


## Day navigation and the all-day band

Both are in every comp, desktop and phone.

**The nav is the dateline.** A separate widget above the tape would state the
day twice, so the chevrons flank the date that was already there — in the
eyebrow on desktop, in the app bar on phone. The label always names the real
date; it never switches to "TOMORROW". Being off today is carried by the
**Today reset** existing at all, which keeps the label purely informative. On
today the reset holds its slot invisibly, so the chevrons never shift.

Stepping a day dims only what the day owns — `.day-owned` on the tape, the
all-day band and the timeline. The header, Top 3, Routines, Projects and the
quote do not flicker, because the nav does not change them.

**The all-day band** is everything that belongs to the day but has no hour, so
the tape is structurally incapable of showing it. It caps the tape from above
for exactly that reason: together they are the whole day. When there is nothing
all-day the band is absent, not empty — see the quiet comps.

**The headline follows the day.** One word changes:

| Day | Headline |
|---|---|
| Today, something ahead | `Next up at 14:00 — Almoço com a Ana.` |
| Any other day | `First up at 09:30 — Retro do sprint.` |
| Nothing on today | `You are free.` |
| Nothing on another day | `Nothing on the clock.` |

On any day but today there is no now-mark — `nowLabel` is null off today, and
the tape keeps its ruler without it. On phone, swiping the tape sideways steps
the day as well; the chevrons are the discoverable path, the gesture the fast one.

## The domain palette

Nine slots: the seven seeded stewardship domains plus two spares. Defined in
`_a.css`, proved in `palette-lab.html`. The old eight-swatch palette in
`lib/schemas/color.ts` is discarded outright — it was tuned for the warm linen
ground of the *first* rejected identity, two visual worlds ago.

| Token | Name | Domain | Light | Dark | Origin |
|---|---|---|---|---|---|
| `--spirit` | Clay | Spirituality | `#8b6031` | `#a5733c` | computed |
| `--travel` | Yellow | Travel | `#ffcc0f` | `#ffd60a` | Apple `systemYellow` |
| `--health` | Green | Health | `#2aa649` | `#30d158` | Apple `systemGreen` |
| `--pine` | Teal | *spare* | `#158266` | `#21b18c` | computed |
| `--code` | Cyan | Code | `#1b93ba` | `#2cc9fc` | computed |
| `--finance` | Blue | Finance | `#0a7cfe` | `#318ffe` | Apple `systemBlue` |
| `--engine` | Indigo | Engine | `#514ad4` | `#5e5ae6` | Apple `systemIndigo` |
| `--family` | Orchid | Family | `#c345fc` | `#c756fc` | chosen |
| `--burgundy` | Rose | *spare* | `#db149b` | `#fc2cb4` | chosen |

The slug is the identity and it is persisted, so a colour can be renamed without
a migration — which is why `--pine` is called Teal and `--burgundy` is Rose.

### How they were chosen

Six were **picked**, three were **computed to fit around them**. Apple's Green,
Blue and Indigo are byte-for-byte in dark and within 0.02 lightness in light —
that shift is what buys Green its 3:1. Yellow is Apple's `#FFCC00`. Orchid and
Rose are ours.

Clay, Teal and Cyan then filled what the six left open:

- **Clay** is the set's one low-chroma slot, so a domain can be quiet without
  going grey — which suits Spirituality. At h66 it is clear of the accent's h41
  and of Yellow's h90.
- **Teal** and **Cyan** fill the 110° hole between Green (h147) and Blue (h257).
  Without them the palette reads as two clusters, and the day tape shows the gap
  as a visible seam.

Hue is shared across themes; only lightness and chroma differ. Three floors, met
in both:

- **ΔE<sub>ok</sub> ≥ 0.12 between any two**, because a domain colour's smallest
  form is a 9px dot. Worst pair is Teal/Cyan at **0.128**.
- **ΔE<sub>ok</sub> ≥ 0.15 from the accent and the priority ring** — a higher bar,
  because confusing a domain with a *state* is worse than confusing two domains.
  Worst is Clay/priority at **0.159**.
- **≥ 3:1 against its own ground**, the non-text contrast line. Worst is Green on
  light at **3.03:1** — and Travel is exempt.

### The one broken rule

**Travel is 1.45:1 on the light ground**, and that is a decision, not an
oversight. A full yellow and 3:1 on `#fafafa` are mutually exclusive: the
brightest yellow that clears the floor is a mustard, and the brief was a full
bright yellow. Brightness won. In dark it is 12.53:1, so the exemption exists
only on the light ground. Do not "fix" it.

### What this fixes

`--engine` was once `#f15a0f` — **byte-identical to the accent**. Engine is the
most frequent domain, so every Engine dot and block on the tape read as
"interactive" or "overdue". It is now Indigo, well clear of the accent.
