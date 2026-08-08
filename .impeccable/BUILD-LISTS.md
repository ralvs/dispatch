# Build brief — Pass 2, the list family

Paste the block below into a fresh Claude Code session at the repo root, on
branch `design/impeccable`. Everything it needs is on disk; it should not need
this file's prose.

**Pass 0 and Pass 1 are landed** (`a1de3b0` → `1009b52`). This is the pass that
finally has enough callers to extract the shared row, and the one that has to
settle two questions Pass 1 opened by answering them only for `/tasks`.

---

## The prompt

> Build **Pass 2 of the Dispatch refactor: the list family**, on branch
> `design/impeccable`. Eight list surfaces plus the two detail pages that hang
> off them — the last part of the app still composed in the linen era.
>
> **Read first, in this order:**
> 1. `DESIGN.md` — the visual system. Accurate and normative.
> 2. `docs/adr/0042-the-page-header-is-the-fine-locator.md` and
>    `docs/adr/0043-the-plus-button-is-the-whole-capture-surface.md` — Pass 0
>    and Pass 1's decisions. **0043 is the one that reaches into this pass**: it
>    deleted a page's standing create furniture and moved the write behind a
>    single `+` on the title's shoulder.
> 3. `app/(authed)/tasks/task-row.tsx` and `app/(authed)/today/day-row.tsx` —
>    the two rows already rebuilt, and the doctrine they hold between them:
>    **presentation may fork, encoding must converge.**
> 4. `components/ui/` as it stands: `PageHeader` (with `titleAction`),
>    `PageSkeleton`, `SectionHead`, `EmptyState`, `Card`, `Checkbox`, `Badge`,
>    `Button`, `Field`. Read the real APIs.
> 5. `docs/adr/0041-the-iron-rules.md`, `docs/adr/0024-one-word-inbox.md` and
>    `CONTEXT.md`. Terminology is load-bearing; do not vary words for
>    readability.
>
> **Scope — eight lists:** `/inbox`, `/projects`, `/quotes`, `/routines`,
> `/links`, `/people`, `/notes` (the list, not the editor), `/notifications`.
> **Plus two detail pages:** `app/(authed)/projects/[id]/project-detail.tsx` and
> `app/(authed)/people/[id]/person-detail.tsx`. They are in scope for one
> specific reason — they hold **the last two legacy page headers in the app**
> (`hairline-strong pb-4` with a mono eyebrow over a 30px title), and they render
> lists of the same objects this pass is rebuilding. Leaving them would carry two
> un-migrated headers through two more passes.
>
> **Out of scope:** `app/(authed)/notes/[id]/*` (the editor — Pass 3), `/journal`
> and `/chat` (Pass 3), `/settings` and `/more` (Pass 4), and `/today` and
> `/tasks`, which are done. Do not redesign them.
>
> ---
>
> ## Phase 0 — two gates, one lab
>
> Pass 1 answered both of these for `/tasks` alone. Neither answer generalises
> on its own, and eight surfaces are about to be written either way.
>
> ### Gate A — what weight is a name?
>
> Pass 1 dropped the task title to **400**, with P1 the single step to 500, and
> the argument was general: *"It was 500 on every row, which spends the system's
> only weight step equally everywhere and so says nothing."*
>
> Every other row in the app is still **500** — a project, a person, a note, a
> routine, a domain, an inbox task, a journal entry, all via `.type-title`. So
> the app currently sets a task title at 400 and a project name at 500, two rows
> apart in the same visual language.
>
> Either the argument generalises — every row name drops to 400, hierarchy comes
> from colour and position as DESIGN.md's Two Weights Rule says it should, and
> `.type-title` loses most of its 24 call sites and possibly its reason to exist
> — or `/tasks` is the exception because it is the one list with a priority worth
> spending the step on, and that exception gets stated as a rule rather than left
> as a difference. **Decide it once, here.**
>
> ### Gate B — do the inline forms follow ADR-0043?
>
> Five surfaces open with a `CollapsibleForm` sitting above the list:
> `/projects`, `/people`, `/quotes`, `/routines`, `/journal` (plus
> `/settings`'s domain form, which is Pass 4 and a config page, not a list).
>
> ADR-0043 deleted exactly this shape from `/tasks` — standing create furniture
> at the top of a list — and moved the write into a dialog behind one unlabelled
> `+`. **The `/projects` half is already recorded as this pass's job**
> (`.impeccable/mocks/README.md`, "One consequence is recorded here rather than
> built"), including that it gains a `+ New project` in the slot `/notes` already
> uses.
>
> What is not decided is whether the other four follow, and the cases are not
> alike:
> - `/quotes`, `/routines`, `/people` create an object, exactly as `/projects`
>   does. The parallel is clean.
> - `/journal` is different in kind: writing the entry **is** the page, not a
>   create action beside a list of entries. Standing furniture may be correct
>   there for the same reason the capture line was wrong on `/tasks`.
>
> Decide the **rule**, not five separate cases, and say which side `/journal`
> falls on and why. Note that `/journal` is Pass 3's — settle the rule here, let
> Pass 3 apply it.
>
> ### The lab
>
> Draw **two or three static comps** in `.impeccable/mocks/`, following
> `.impeccable/mocks/README.md` conventions (shared `_a.css`, plus a
> `*.standalone.html` that inlines it). Desktop and phone, light and dark.
>
> Show **`/projects` and `/people` side by side under each option**, at a real
> load — 8–14 rows, mixed domains, some with a badge and some without, a group
> boundary visible, and the empty state. `/projects` because it is the one with
> a create form and two colour dots per row; `/people` because it is the
> simplest row in the app and will expose a weight decision with nothing else to
> hide behind.
>
> Then **stop and show me.** Do not build past this line until I pick.
>
> ---
>
> ## Phases 1–5 — after I pick
>
> Commit at the end of each phase; do not bundle them.
>
> 1. **`ListRow`, and this time build it.** Pass 0 specified it and did not
>    build it (zero callers); Pass 1 was told not to (one caller is not evidence
>    of a shared shape). There are now nine: the task row, the Today row, and
>    seven `<li className="hairline py-3">` variants across this pass's
>    surfaces.
>
>    Extract **only the geometry they genuinely share** — the hairline, the
>    `min-h-12`, the `py-3`, the `gap-3`, the leading slot / body / trailing slot
>    columns, and the 44px touch target a row's control carries without drawing.
>    **Rows keep their own composition.** That is the doctrine `day-row.tsx`
>    states in its header comment and Pass 1 held to: the Tasks row kept its meta
>    line because that is what it is built around. A `ListRow` that grows a
>    `variant` prop per surface is the failure mode; if you find yourself adding
>    the third one, the abstraction is wrong and the geometry is all that should
>    have moved.
>
> 2. **The rows, on the chosen weight.** All eight surfaces. Carry the encodings
>    that are already settled — do not re-decide them:
>    - **The domain dot leads, in the left column, and holds its slot when
>      absent** (`task-row.tsx`, `day-row.tsx`). `/projects` currently renders
>      two `ColorDot`s per row — the project's own colour inline before the name,
>      and the domain's in the meta line. Two dots of different meaning in one
>      row is the thing the measured palette exists to prevent; resolve it.
>    - **Late is `Xd late`, once**, via `formatLateLabel` in `lib/dates.ts`.
>    - **Priority is the ring on the checkbox**, never a text chip. `PriorityBadge`
>      is deleted; do not reintroduce it.
>    - **A domain's colour resolves through `var(--domain-<slug>)`** from the
>      stored slug. Never a hex in a component.
>
> 3. **`/inbox` and the third task row.** `inbox-row.tsx` is a third rendering of
>    a task, alongside `TaskRowItem` and `TaskDayRow`. Unlike those two it has no
>    composition of its own worth keeping — it is a title, a note chip, and a row
>    of domain buttons. Decide whether it becomes `TaskRowItem` with the domain
>    buttons in the trailing slot, or stays separate. **Filing stays one-way**
>    (ADR-0024) and the optimistic removal in `inbox-list.tsx` is behaviour —
>    do not restructure it.
>
> 4. **Group labels on `SectionHead`.** Sixteen `font-mono text-eyebrow uppercase
>    tracking-widest text-ink-4` group labels remain across eight files. Pass 1
>    moved the Tasks groups to `SectionHead` (16px/500) and that is the
>    precedent. `/links` (Unread / Read), `/projects` (the four status groups),
>    `/notes` (Needs review / All notes) are the main ones.
>
> 5. **The two detail pages, headers and rows, then sweep.** `PageHeader` on
>    both — the name is the title, and the relationship/type badge and the
>    counts are what the measure slot is for. Their bodies get the row work from
>    phase 2 and nothing more; they are not being recomposed. Then screenshot
>    all ten surfaces in both themes at both widths, plus `/today` and `/tasks`
>    to confirm nothing moved under them, and update `DESIGN.md` with whatever
>    Gate A and Gate B settled.
>
> ---
>
> **Constraints that outrank everything above:**
> - The six iron rules (ADR-0041). `requireOwner()` stays the first line of every
>   page and action; all date logic through `lib/dates.ts`.
> - **Do not touch the optimistic layers.** `inbox-list.tsx`,
>   `notification-list.tsx`, `note-list.tsx` and `quote-row.tsx` each own
>   `useOptimistic`/`useTransition` state. This is a visual pass. If a visual
>   change seems to require restructuring one, stop and say so.
> - **Do not redesign `/today` or `/tasks`.** Lifting a shared helper out of
>   either is fine; changing how either renders is not. If a shared primitive
>   would alter them, they win and the primitive bends.
> - **Mobile is a responsive layer, not a fork.** One component tree. Rows ≥48px.
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

## Why these two gates and not others

Everything else in this pass is application. The rows are eight variations on
one shape, the group labels have a precedent, and the encodings were settled in
Pass 1. What is genuinely open is the pair of decisions Pass 1 made **locally**:
it dropped a title to 400 and it deleted a page's standing create form, both
with arguments that read as general and were applied to one surface.

If Pass 2 just follows `/tasks`, it generalises two decisions by imitation. If
it just leaves the other surfaces alone, the app ships two weights for one kind
of thing and two shapes for one kind of action. Either is a decision; neither
should be made by default eight times in a row.

## Why the detail pages come along

`project-detail.tsx` and `person-detail.tsx` hold the last two legacy headers in
the app. They are also the two surfaces that render lists of the objects this
pass is rebuilding, so their rows come free once phase 2 lands. Folding them in
costs one phase and closes the header migration completely — after this pass,
`hairline-strong pb-4` appears nowhere.

## What comes after

- **Pass 3 — the writing surfaces**: `notes/[id]` (the editor), `/journal`,
  `/chat`. Different job: long-form measure, caret, editor chrome. `/journal`
  also applies whatever Gate B settled.
- **Pass 4 — `/settings`, `/more`, the capture palette.**
