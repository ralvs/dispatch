# Build brief — Pass 0, the shared chrome

Paste the block below into a fresh Claude Code session at the repo root, on
branch `design/impeccable`. Everything it needs is on disk; it should not need
this file's prose.

This is the first of five passes that finish the refactor Today started. It is
deliberately not a page: it settles the objects the other thirteen surfaces all
consume, so that passes 1–4 apply a decision instead of re-taking it.

---

## The prompt

> Build **Pass 0 of the Dispatch refactor: the shared chrome**, on branch
> `design/impeccable`. This is not a page refactor. It settles the handful of
> objects that every non-Today surface repeats, so the twelve page refactors
> that follow apply a decision rather than each inventing one.
>
> **Read first, in this order:**
> 1. `DESIGN.md` — the current visual system. Unlike the Today build, this file
>    is now **accurate and normative**: it was regenerated after revision A
>    shipped. Follow it.
> 2. `.impeccable/surfaces/app-authed-today.md` — the Today surface brief. Today
>    is the only surface built in this world, so it is the **precedent** for
>    everything you design here.
> 3. `app/(authed)/today/day-bands.tsx`, `day-row.tsx`, `today-styles.tsx` — the
>    shipped idioms you are generalising.
> 4. `docs/adr/0041-the-iron-rules.md`, `docs/adr/0039-ui-primitives-line-depth.md`,
>    `docs/adr/0028-the-app-shell-owns-the-viewport.md`, and `CONTEXT.md`.
>    Terminology is load-bearing; do not vary words for readability.
>
> **The state of the app.** Revision A's tokens shipped and every surface
> inherits them, but only `/today` was composed in the new world. The other
> thirteen are *neutralised, not designed*: they still run the linen-era page
> header, and `--font-serif` in `app/globals.css` is a compatibility shim
> aliased to Geist, which is the only reason they don't look broken. The
> evidence, measured:
>
> | Legacy idiom | Where |
> |---|---|
> | `hairline-strong pb-4` page header — mono eyebrow + `font-serif` h1 | 28 files |
> | `font-serif` | 53 files outside `app/compare` |
> | `py-8 text-center font-serif italic text-ink-3` empty state | 13 call sites |
> | `loading.tsx` duplicating its page's header verbatim + 6 identical pulse bars | 17 files |
>
> **The mono eyebrow itself is alive and stays.** `font-mono text-eyebrow
> uppercase tracking-widest text-ink-3` is the new world's system label — it is
> what the day nav dateline, the tape heading and the quote card use. What is
> dead is the *page-header composition* (eyebrow stacked over a serif h1 over a
> strong hairline) and `font-serif`. Do not confuse the two and do not sweep the
> eyebrow class.
>
> ---
>
> ## Phase 0 — the page header, and a gate
>
> **This is the one piece of real design in the pass, and Today cannot answer
> it.** Today has no page header: its `h1` is `DayHeadline`, a sentence about
> the day, and its dateline is the day nav. A list page needs something else,
> and the question is genuinely open:
>
> - The desktop `AppHeader` already names the section — the active pill tab says
>   "Tasks". A 30px "What's in motion" underneath may be stating it twice.
> - The phone has **no** header bar, only the dock. So the page name may be
>   needed at 393pt and redundant at 1092px, which is an asymmetry the header
>   has to carry deliberately rather than by accident.
> - `AppHeader` owns a `mb-16` gap to whatever a page leads with
>   (`components/app-header.tsx`). Whatever you design inherits that rhythm.
> - Several pages open with an action (`+ New note`) or a form (`ProjectForm`),
>   so the header is a slot, not a title.
>
> Draw **two or three options as static comps** in `.impeccable/mocks/`,
> following the conventions in `.impeccable/mocks/README.md` (shared `_a.css`,
> plus a `*.standalone.html` that inlines it). Each option at desktop and phone,
> light and dark, over the same three real pages: `/projects` (header + form +
> grouped rows), `/notes` (header + trailing action) and `/inbox` (header +
> subtitle, empty state visible). Serve them with the `mocks` entry in
> `.claude/launch.json` on port 4500.
>
> Then **stop and show me the comps.** Do not build past this line until I pick
> one. Everything after Phase 0 is application, and applying the wrong header to
> twelve pages is the expensive mistake this pass exists to prevent.
>
> ---
>
> ## Phases 1–5 — after I pick
>
> Commit at the end of each phase; do not bundle them.
>
> 1. **The chrome primitives**, in `components/ui/`, exported from
>    `components/ui/index.ts` and composed like the existing ones (`tv` variants,
>    the `card`/`button` house style):
>    - `PageHeader` — the chosen option, with slots for a subtitle and a trailing
>      action.
>    - `SectionHead` — promote it out of `app/(authed)/today/day-bands.tsx:35`,
>      where it is currently private, unchanged: `h2` at base/500/−0.02em with a
>      baseline-aligned aside.
>    - `EmptyState` — **settle the conflict.** The legacy is centred, serif and
>      italic; the shipped new-world one (`day-bands.tsx:76`, `Placeholder`) is
>      left-aligned, hairline-bottomed, `text-base italic text-ink-3`, with an
>      optional `not-italic` hint beneath. Today's is the precedent and the
>      italic survives; make it the shared object and say in a comment why the
>      centred variant did not.
>    - `ListRow` — the generic row geometry only, extracted from `TaskDayRow`
>      (`day-row.tsx`): `min-h-12`, `border-b border-line last:border-b-0`,
>      `gap-3`, leading slot / title / meta / trailing slot, and the 44px hit
>      target the checkbox carries without drawing. **Nothing task-specific** —
>      no priority ring, no star, no due-date logic. Those belong to Pass 1.
>    - `PageSkeleton` — the header plus a row-count prop, so a `loading.tsx` is
>      three lines and cannot drift from the page it stands in for.
>
>    Only extract what is used 3+ times with the same intent. Do not build
>    variants nobody calls yet.
>
> 2. **Migrate the twelve headers and their skeletons.** `/inbox`, `/notes`,
>    `/projects`, `/quotes`, `/routines`, `/links`, `/people`, `/notifications`,
>    `/journal`, `/settings`, `/chat`, `/more`, plus `app/(authed)/error.tsx` and
>    `app/(authed)/not-found.tsx`. Header, skeleton and empty state only — **do
>    not touch each page's body composition.** That is Passes 2–4, and mixing
>    them makes this diff unreviewable.
>
> 3. **`/tasks` gets the header and skeleton too, and nothing else.**
>    `app/(authed)/tasks/` is Pass 1 and is being redesigned in full next; it
>    takes the shared header now so it is not the one page left in the old
>    composition, and its filter strip, rows and dialog are untouched here.
>
> 4. **Delete the shim.** Remove every remaining `font-serif` call site, then
>    remove `--font-serif` (`app/globals.css:174`) and the `.font-serif` rule
>    (`~:255`) **in the same commit**. These must go together: deleting the rule
>    while a call site survives hands that element Tailwind's built-in serif
>    stack, and a real serif appears where a Geist alias used to be. Grep to
>    zero — including `app/compare`, which still has four files using it — then
>    delete. Two call sites are genuine italic quotations
>    (`app/(authed)/quotes/quote-row.tsx:43`, `today/resurfaced-quote.tsx:42`);
>    those keep the italic, they just stop asking for a serif family.
>
> 5. **Sweep and document.** Screenshot all fourteen routes in both themes at
>    both widths, fix what actually broke, then regenerate `DESIGN.md` with
>    `/impeccable document` and record the header decision as an ADR — the next
>    number is **0042** — so Passes 1–4 can cite it instead of re-reading comps.
>
> ---
>
> **Constraints that outrank everything above:**
> - The six iron rules (ADR-0041), cited by number at ~70 call sites.
>   `requireOwner()` stays the first line of every action and page; the
>   security boundary does not move because a header changed.
> - **`app/compare/` is out of scope.** It is a scratch surface pending a
>   keep-or-delete decision. Touch it only in Phase 4, only to remove
>   `font-serif`, and do not migrate it to the new primitives.
> - **Do not redesign `/today`.** Promoting `SectionHead` out of it is the only
>   sanctioned change; if a shared primitive would alter how Today renders,
>   Today wins and the primitive bends.
> - **Mobile is a responsive layer, not a fork.** One component tree, max-width
>   queries beside their desktop peers. If you find yourself writing a
>   `<MobileHeader>`, stop.
> - **Do not "fix" the `--ink-3` / `--ink-4` contrast.** It misses WCAG AA and
>   that is a recorded decision for fidelity to the pinned palette
>   (`DESIGN.md`, "The Recorded Contrast Tradeoff").
> - Compose `components/ui/` primitives; no raw hex in app code; Lucide icons
>   only; honour `prefers-reduced-motion`.
> - Biome lint, Biome format and `tsc --noEmit` clean before every commit.
>   Conventional commits.
>
> **Verify in the browser, not by assertion.** Use the `dispatch` entry in
> `.claude/launch.json`, and check both themes and both widths per phase.
>
> Do not merge to `main`. The branch merges in one go when all five passes land.

---

## Why this is a pass and not a page

Thirteen surfaces repeat one header in 28 files and one empty state in 13. If
the refactor went page by page, the first page would invent the replacement and
the remaining twelve would either copy it by hand or drift — thirteen dialects
with no arbiter, discovered at the end. Settling it once costs one session and
makes Passes 1–4 mostly application.

The `font-serif` shim is the forcing function. While it exists, a page that was
never touched looks fine, so drift is invisible. Deleting it in Phase 4 makes
every un-migrated call site a thing you can grep for rather than a thing you
have to notice.

## Why Phase 0 has a gate

Everything after it is mechanical, and the page header is the only decision in
the pass that Today does not already answer — Today's `h1` is a sentence about
the day, not a page title, and Today has no page header to copy. Getting it
wrong is cheap to see in a comp and expensive to unwind across twelve pages.

## What comes after

- **Pass 1 — `/tasks`, alone.** It owns the task row that Today, Inbox,
  `projects/[id]` and `people/[id]` all re-render, and its priority encoding
  must be the ring primitive Today shipped, not a second one.
- **Pass 2 — the list family**, batched: inbox, projects, quotes, routines,
  links, people, notes list, notifications.
- **Pass 3 — the writing surfaces**: `notes/[id]`, journal, chat.
- **Pass 4 — settings, more, capture.**
