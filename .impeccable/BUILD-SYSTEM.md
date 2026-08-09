# Build brief — Pass 4.5, the system pass

Paste the block below into a fresh Claude Code session at the repo root, on
branch `design/impeccable`.

**Runs between Pass 4 and Pass 5.** It is not a route pass — it has no surface of
its own. It closes four findings a `/simplify` run deliberately skipped because
each is a design decision rather than a cleanup, plus one defect found while
verifying Pass 4.

**Why before Pass 5:** two of the findings are system-wide (the header's second
reading type, the section rhythm). Pass 5's closing sweep is supposed to *prove*
the system is consistent; it cannot do that while the rhythm rule in `DESIGN.md`
matches almost nothing in the tree.

---

## The prompt

> Build **Pass 4.5 of the Dispatch refactor: the system pass**, on branch
> `design/impeccable`. No new surfaces. Four findings and one defect, two of
> which need a decision from me before any code is written.
>
> **Read first:**
> 1. `DESIGN.md` — the visual system.
> 2. `docs/adr/0042` (the header), `0044` (rows), `0045` (domains / More).
> 3. `components/ui/page-header.tsx`, `list-row.tsx`, `app/(authed)/layout.tsx`.
> 4. Commits `059fa0a`, `e9bcbdf`, `1e32025` — the seven fixes a `/simplify`
>    pass already applied. **Do not re-audit them and do not re-run `/simplify`
>    on this diff.**
>
> ---
>
> ## Fix first, no gate needed — the More menu clips its System group
>
> `components/more-menu.tsx:88-92`. The panel sets
> `max-h-[min(420px,58dvh)]` for the phone sheet. The desktop variant overrides
> `inset-x`, `bottom`, `top`, `width`, `radius` and padding — **but never resets
> `max-h`**, so the sheet's cap leaks into the popover.
>
> Measured at a 720px viewport: `58dvh` = 417px, panel top `4.75rem` = 76px, so
> the panel ends at 493px — and the rendered bottom edge measures 492px. The
> System group (Notifications, Settings) sits below that fold. `overflow-y-auto`
> means it scrolls rather than being unreachable, but a 280px popover with ~230px
> of free space beneath it and its last group invisible reads as a seven-item
> menu, and Settings is the destination that most needs finding.
>
> Reset it on the desktop variant. Keep a cap for short windows rather than
> removing it outright — `lg:max-h-[calc(100dvh-6rem)]` or similar. Verify at
> 720 **and** 900 tall, and check the phone sheet still caps as before.
>
> ---
>
> ## Phase 0 — two gates
>
> ### Gate A — the measure slot is carrying things that are not counts
>
> `PageHeader` documents `Measure` as *"a figure and the word it counts"*, and
> renders the figure `font-medium tabular-nums text-ink-2` — a treatment designed
> for numerals. Two detail pages pass plain attributes with an **empty label**:
>
> - `projects/[id]/project-detail.tsx:72-73` — `Internal`, `Active`
> - `people/[id]/person-detail.tsx:75-78` — the relationship, the company
>
> So `Internal` and a person's employer render in tabular figures with a
> label-less gap beside them. The type already absorbed the hatch
> (`count: number | string`), and the duplicate-key symptom was fixed in
> `1e32025` by keying on position — **the modelling problem is all that is left**,
> and it is not urgent, only wrong.
>
> Note both pages already render a **Details** card carrying attributes of
> exactly this kind, which is what makes this a real question rather than a
> naming one.
>
> - **Option A — `PageHeader` gains a second reading type.** `facts?: ReactNode[]`
>   rendered plain at `ink-3`, no tabular-nums, beside the measure. Say whether
>   facts sit before or after the counts.
> - **Option B — attributes move down into the Details card**, and the header
>   measure keeps only real counts: `3/8 milestones`, `4 facts`. The header gets
>   quieter and the card gets complete.
>
> Both restyle four readings on two pages, which is why it is a gate and not a
> refactor.
>
> ### Gate B — the rhythm rule matches almost nothing
>
> `DESIGN.md` states one rule: *"16px between stacked cards, 34–40px between
> sections, 64px under the header."* No module enforces it. What the tree
> actually does:
>
> | Value | px | Where |
> |---|---|---|
> | `mt-6` | 24 | `journal/page.tsx:32`, `notes/note-list.tsx:66`, `chat-thread.tsx:32` |
> | `mt-8` | 32 | `projects`, `settings` ×2, `links`, `domains`, `tasks` ×3, both detail pages' Details |
> | `mt-10` | 40 | `tasks/task-list.tsx:398` |
> | `mt-14` | 56 | `project-detail.tsx:285`, `person-detail.tsx:198,242,353` |
>
> **One call site in the whole app is inside the documented band.** There are
> also three different first-child cancellations — `first:mt-0` at
> `projects/page.tsx:34` and `notes/note-list.tsx:66`, and `first:mt-2` at
> `journal/page.tsx:37`.
>
> And "64px under the header" is ambiguous in a way worth settling while you are
> here: 64px is `AppHeader`'s `mb-16`, which sits under the **app** header. The
> **page** header (`PageHeader`) adds its own `mb-[26px] lg:mb-[30px]` beneath
> the title. Two different headers, one sentence.
>
> **The real question is which is wrong — the code or the doc.** The shipped
> spacing looks less like drift than like an undocumented three-tier rhythm:
> ~32px between sections of a list page, ~56px between major blocks on a detail
> page, 24px in a couple of tighter stacks. If that is deliberate, the honest
> outcome is **updating `DESIGN.md` to describe it**, not flattening four detail
> routes to 36px.
>
> - **Option 1 — the doc wins.** Everything moves into 34–40px. Detail pages drop
>   from 56 to ~36, which is a visible change to every detail route.
> - **Option 2 — the code wins, and gets named.** Document a two- or three-tier
>   scale, pick the exact values, and normalise the strays onto them.
> - **Option 3 — either of the above, plus a module that owns it.** A `PageBody`
>   wrapper (or the `(authed)` layout) applies one `space-y-*` to the section
>   stack; sections carry no top margin, so the first-child case cannot arise and
>   all three `first:mt-*` cancellations disappear.
>
> **Do not flatten the detail pages without my answer.**
>
> ### The lab
>
> Draw **two or three static comps** in `.impeccable/mocks/`, per
> `.impeccable/mocks/README.md` (shared `_a.css` plus a `*.standalone.html`).
> Desktop and phone, light and dark. Show `/projects/[id]` and `/people/[id]`
> under each combination — they are the only two pages that carry both gates at
> once. Include one list page (`/domains` or `/links`) so the two rhythms can be
> seen against each other rather than argued about.
>
> Then **stop and show me.** Do not build past this line until I pick.
>
> ---
>
> ## Decided in this brief — implement, do not re-litigate
>
> ### Finding 3 — the `pending` dimming, and what it actually shows
>
> `pending ? "opacity-50" : ""` appears **seven** times. The handoff that raised
> this framed it as a `ListRow` charter question. It is not, for two reasons it
> did not have:
>
> - **`ListRow` already exposes `className`**, and `quotes/quote-row.tsx:42`
>   already uses exactly that for this. A `pending` prop would be a *second*
>   sanctioned way to express one thing, which is worse than the repetition.
> - **The treatment is already system-wide.** `Button`'s `isPending` variant
>   resolves to the same `opacity-50`. So the app has one pending language spoken
>   in three dialects: a `Button` variant, a `ListRow` `className`, and a raw
>   `className` on four wrapping divs (`task-dialog.tsx:164`,
>   `domain-row.tsx:122`, and both detail pages).
>
> **Do:** leave all seven call sites alone. Add the rule to `DESIGN.md` instead —
> *an optimistic mutation in flight dims its own subtree to 50% and nothing else
> moves* — and cross-reference `Button.isPending` as the canonical instance. Then
> amend `list-row.tsx`'s docblock to state the boundary explicitly: `className`
> is the sanctioned hatch for **state** (pending, selected); a per-surface
> `variant` prop remains the failure mode. The docblock currently says "nothing
> else" while the component already takes `align` and `className`, which is the
> ambiguity that made this look like an open question.
>
> ### Finding 4 — two efficiency findings, both closed
>
> Both were judged immaterial by the prior pass and I agree. Record the reasoning
> where the code is, so they are not rediscovered as novel:
>
> - `lib/dates.ts` `formatLateLabel` builds two Luxon `DateTime`s per overdue row
>   where epoch subtraction would do. **Leave it.** Reverting breaks that file's
>   contract as the single Luxon-based home of date logic (iron rule #1,
>   ADR-0002) for no measurable gain on a list of tens.
> - `projects/page.tsx:21-22` runs two `.filter()` passes for the measure plus one
>   per status group. **Leave it.** Server component, once per request, small
>   array; a `reduce` into a counts map costs more readability than it buys.
>
> A one-line comment at each site is enough. Do not open a third question about
> either.
>
> ---
>
> **Constraints:**
> - The six iron rules (ADR-0041).
> - **This is a visual and structural pass. Do not touch behaviour** — no
>   optimistic layers, no service calls, no auth.
> - **Do not redesign any surface.** Gate B may change spacing on every page;
>   that is spacing, not composition.
> - **Mobile is a responsive layer, not a fork.** One component tree.
> - Compose `components/ui/` primitives; no raw hex; Lucide only.
> - Biome lint, Biome format and `tsc --noEmit` clean before every commit.
>   Conventional commits, author `Renan Alves <renan@alves.id>`.
>
> **Verify in the browser, not by assertion.** Use the `dispatch` entry in
> `.claude/launch.json`. Prefer `javascript_tool` computed-style reads over
> screenshots for spacing — this pass is almost entirely spacing, and a
> screenshot cannot tell 32px from 36px. The Browser pane goes unresponsive after
> heavy interaction; a fresh tab recovers it.
>
> Do not merge to `main`. Pass 5 (`.impeccable/BUILD-EDGES.md`) follows.

---

## Why this is a pass and not a cleanup

Three of the five items are one finding wearing different clothes: **no module
owns the space between things.** `PageHeader` owns its own bottom margin, every
page hand-manages what follows, `ListRow` owns a row's internals but not the gap
to the next section, and the one written rule describes a band that a single
call site in the app occupies.

That is why the rhythm question is worth a gate rather than a sweep. Normalising
32/40/56 onto one number is ten minutes; deciding whether a detail page is
*supposed* to breathe more than a list page is the actual design question, and
the answer determines whether `DESIGN.md` or the tree is the thing that changes.

## What the handoff got right, and the one thing it missed

Its four findings all verified against the tree, and its instinct to skip them
was correct — each is a decision, not a cleanup. The framing of finding 3 is the
one thing to correct: `ListRow` already takes `className`, and `Button` already
ships the same `opacity-50` under `isPending`, so the question was never whether
the primitive widens. It is that a system-wide state has no written rule, which
is a `DESIGN.md` gap rather than an API one.

## After this pass

**Pass 5 — the edges** (`.impeccable/BUILD-EDGES.md`), unchanged: `/sign-in`,
the failure states, the toaster, the three suggestion popovers, the PWA chrome,
the `.type-title` reckoning, and the closing sweep. Add one line to that sweep's
grep list while this pass is fresh: **every responsive override resets what it
needs to** — the More menu defect above is exactly the class of bug a
mobile-first cap leaking into a desktop variant produces, and it is invisible to
every other check in the list.
