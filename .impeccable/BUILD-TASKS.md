# Build brief — Pass 1, the Tasks page

Paste the block below into a fresh Claude Code session at the repo root, on
branch `design/impeccable`. Everything it needs is on disk; it should not need
this file's prose.

**Pass 0 is landed** (`a1de3b0` → `8107447`), so this is ready to run.

---

## The prompt

> Build **Pass 1 of the Dispatch refactor: the Tasks page**, on branch
> `design/impeccable`. `/tasks` is the app's second hub — the one surface other
> than Today that gets returned to all day — and it is the last one still
> composed in the linen era.
>
> **Read first, in this order:**
> 1. `DESIGN.md` — the visual system. Accurate and normative.
> 2. `docs/adr/0042-the-page-header-is-the-fine-locator.md` — the page header
>    decided in Pass 0, plus
>    `docs/adr/0040-one-task-form-in-a-dialog.md` and
>    `docs/adr/0029-task-filters-and-the-due-date-invariant.md`. **Both of those
>    are settled product decisions, not visual ones. Do not re-open them:** the
>    form stays in a dialog, and the filter set stays what it is.
> 3. `components/ui/` as it now stands — Pass 0 added `PageHeader`,
>    `SectionHead`, `EmptyState` and `PageSkeleton`. Read their real APIs; do not
>    trust this brief's memory of them.
>
>    **There is no `ListRow`.** Pass 0 specified one and deliberately did not
>    build it: that pass touched headers, skeletons and empty states only, so it
>    would have shipped with zero call sites, and the geometry should come from
>    the rows it has to serve rather than from a guess. You are the first pass
>    with a real row in hand. **Do not build the shared `ListRow` here either** —
>    build the Tasks row, and let Pass 2 extract the geometry once `/inbox`,
>    `projects/[id]` and `people/[id]` are three more callers with stated needs.
>    One caller is not evidence of a shared shape.
> 4. `app/(authed)/today/day-row.tsx` and `day-bands.tsx` — the shipped
>    new-world row and bands. They are the precedent.
> 5. `docs/adr/0041-the-iron-rules.md` and `CONTEXT.md`. Terminology is
>    load-bearing; do not vary words for readability.
>
> **Scope — eight files, ~1,660 lines, all under `app/(authed)/tasks/`:**
> `task-list.tsx` (447), `task-fields.tsx` (399), `task-row.tsx` (244),
> `task-filters.tsx` (177), `task-dialog.tsx` (159), `task-note-popover.tsx`
> (119), `capture-bar.tsx` (115), `loading.tsx`.
>
> **Out of scope:** `/inbox`, which also renders tasks through a third row
> (`app/(authed)/inbox/inbox-row.tsx`). It is Pass 2. Note what you settle here
> so Pass 2 can follow it, and leave the file alone.
>
> ---
>
> ## The doctrine you are inheriting, and it is not what you'd guess
>
> Today did **not** share its row with `/tasks`. It forked deliberately, and
> `app/(authed)/today/day-row.tsx` states why in its header comment: the two
> rows answer different questions — *"Tasks asks 'what is this task', Today asks
> 'what is my day'"* — and what they share is **behaviour**, not presentation:
> `bindTaskHandlers`, `applyTaskLists` / the intent runner in
> `lib/task-interaction/`, and the same server actions. `TaskDayRow` imports
> exactly one thing from `task-row.tsx`: the `TaskRowHandlers` type.
>
> **Honour that seam. Do not merge the two rows into one component.** A
> `TaskRowItem` that grows a `variant="day"` prop to serve both is the failure
> mode this pass exists to avoid — it would drag Today's composition back into
> the file Today deliberately left. `TaskRowItem` gets rebuilt in the new world
> **as its own composition**, keeping its meta line, which is the thing Today
> dropped and this row is built around.
>
> What *must* converge is the **encoding**, because a visual language cannot
> fork across two pages of the same app:
>
> - **Priority.** `components/ui/checkbox.tsx` already carries the ring — a
>   `priority` prop taking the stored 1–4, gated behind `TODAY_VARIANT` in
>   `lib/ui/variant.ts`. `/tasks` still draws priority as `PriorityBadge`, a
>   text chip from `task-fields.tsx`. Two encodings of one thing. **The ring
>   wins in the row**; the badge stays only where a form needs an explicit,
>   labelled control, and if it survives nowhere, delete it.
> - **Overdue.** Today renders `6d late` (`lateLabel` in `day-row.tsx`). Use the
>   same label and the same accent, and lift the helper somewhere both can
>   import rather than copying it.
> - **Domain colour.** The 9px dot resolved through `var(--domain-<slug>)` —
>   never a stored hex (`DESIGN.md`, "The Stored Slug Rule").
>
> ---
>
> ## Phase 0 — the page shape, and a gate
>
> One real design question, and Pass 0's header made it sharper rather than
> answering it.
>
> `PageHeader` option D puts a **measure** on the title's baseline, in Today's
> counters idiom — a quiet mono reading of the page. But `/tasks` already has
> one, and **it is interactive**: `TaskStatusStrip` (`task-filters.tsx:26`)
> renders `open · overdue · today` with counts in `font-mono text-meta`, and
> those counts *are* the status filter. `app/(authed)/tasks/page.tsx` says so in
> a comment — the header is delegated to the client component precisely because
> the strip owns filter state.
>
> So on every other page the measure is a readout, and here the same idiom in
> the same slot is a control. Resolve it. The options, and none is obviously
> right:
>
> - The strip **takes** the measure slot, and the header accepts an interactive
>   measure — clean, but a mono count now means "clickable" on one page and
>   "informational" on eleven.
> - The strip sits **below** the header as its own filter bar with the scope
>   filters (`TaskScopeFilters` — project and domain), and the measure slot
>   either goes unused or carries a non-interactive total.
> - The strip **becomes** something visibly interactive — pill-shaped, in the
>   tab-group idiom the shell already uses — and stops borrowing the measure's
>   clothes entirely.
>
> Draw the page as **two or three static comps** in `.impeccable/mocks/`,
> following `.impeccable/mocks/README.md` conventions (shared `_a.css`, plus a
> `*.standalone.html` that inlines it). Desktop and phone, light and dark. Show
> a realistic load — 15–20 open tasks across three domains, a couple overdue, a
> Top 3 with a starred row, and the "Recently done" group — plus the empty
> state. The whole page, not just the header: capture bar, filter bar, groups,
> rows. Serve on port 4500 via the `mocks` entry in `.claude/launch.json`.
>
> Then **stop and show me.** Do not build past this line until I pick one.
>
> ---
>
> ## Phases 1–4 — after I pick
>
> Commit at the end of each phase; do not bundle them.
>
> 1. **The filter bar and the header**, per the chosen comp. `TaskStatusStrip`
>    and `TaskScopeFilters` keep their behaviour exactly — the shareable
>    `?status=&project=&domain=` query string, the seeding from `searchParams`,
>    and the rule that filtering happens client-side inside `TaskList` and is
>    deliberately not part of the cache key. Chrome only.
> 2. **`TaskRowItem`, rebuilt.** New-world composition on `ListRow`'s geometry,
>    with the priority ring on the checkbox, `Xd late` for overdue, the domain
>    dot, and the meta line it keeps. Preserve every affordance it has now: the
>    star, the note chip and `TaskNotePopover`, mention chips, the recurrence
>    glyph, the completion time in "Recently done", `manageable`, `timeLabel`,
>    `starDateIso`, and `initialEditing` for the `?edit=` deep link from Today.
>    Losing one of those is a regression, not a simplification.
>
>    **One live bug to fix while you are in there.** An overdue row currently
>    reads `Overdue overdue 1d`: `task-row.tsx` prepends the word `"Overdue "`
>    so the state is never colour-only, and `formatDueLabel` in `lib/dates.ts`
>    independently returns `overdue 1d` for the same task. Today does not have
>    this — it renders `lateLabel`, `6d late`, once. Converging on Today's label
>    resolves the duplication and the divergence together.
> 3. **The capture bar and the dialog.** `CaptureBar` is the page's one standing
>    action and should read as kin to the shell's Capture pill without becoming
>    a second one. `TaskDialog` and `task-fields.tsx` get the new field rhythm
>    from `components/ui/field.tsx`; the dialog stays a dialog (ADR-0040).
> 4. **Groups, skeleton, sweep.** The status groups and "Recently done" on
>    `SectionHead`. The empty states and `loading.tsx` already moved to
>    `EmptyState` and `PageSkeleton` in Pass 0 — check them against the new
>    composition rather than rebuilding them. Then screenshot `/tasks` and
>    `/today` in
>    both themes at both widths — **both**, because a change to the shared
>    checkbox or the late label lands on Today too.
>
> ---
>
> **Constraints that outrank everything above:**
> - The six iron rules (ADR-0041). `requireOwner()` stays the first line;
>   `todayIso` stays derived per request, never cached, because an entry that
>   survived midnight paints yesterday's overdue set; all date logic through
>   `lib/dates.ts`.
> - **Do not touch the optimistic layer.** `useOptimistic`, `applyTaskLists`,
>   `bindTaskHandlers`, `useTaskIntentRunner` and the `optimisticTask*` builders
>   in `task-list.tsx` are behaviour, and this is a visual pass. If a visual
>   change seems to require restructuring them, stop and say so.
> - **Do not redesign `/today`.** Lifting a shared helper out of it is fine;
>   changing how it renders is not.
> - **Mobile is a responsive layer, not a fork.** One component tree. Rows ≥48px,
>   every checkbox carrying a 44px hit slug it does not draw.
> - **Do not "fix" the `--ink-3` / `--ink-4` contrast** (`DESIGN.md`, "The
>   Recorded Contrast Tradeoff").
> - Compose `components/ui/` primitives; no raw hex in app code; Lucide only;
>   honour `prefers-reduced-motion`.
> - Biome lint, Biome format and `tsc --noEmit` clean before every commit.
>   Conventional commits.
>
> **Verify in the browser, not by assertion.** Use the `dispatch` entry in
> `.claude/launch.json`.
>
> Do not merge to `main`. The branch merges in one go when all five passes land.

---

## Why Tasks goes alone, and second

It is the largest surface in the app after Today and the only other one with a
full interaction model — optimistic list mutation, a filter set in the URL, a
dialog form, a capture line. Batching it with the list pages would mean its
decisions arrive mid-batch and the simpler pages either wait or guess.

It goes *after* the chrome and *before* the list family because of what it
settles downstream: `/inbox` renders tasks through its own third row, and
`projects/[id]` and `people/[id]` show task lists. All three are Pass 2, and all
three should follow whatever the rebuilt `TaskRowItem` establishes rather than
negotiating with it.

## What the earlier plan got wrong

The pass plan said Pass 1 must unify "the task row that Today, Inbox and the
detail pages all re-render". Today had already decided otherwise, in code and in
a comment: the row forks on presentation and converges on behaviour. The brief
above follows the code. What actually needs converging is narrower and cheaper —
priority, the late label, the domain dot — and the priority ring already exists
in the shared `Checkbox`.
