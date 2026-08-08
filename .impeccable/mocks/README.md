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
