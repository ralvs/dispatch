# Build brief — Pass 4, the configuration surfaces

Paste the block below into a fresh Claude Code session at the repo root, on
branch `design/impeccable`. Everything it needs is on disk; it should not need
this file's prose.

**Passes 0–3 must be landed first.** This pass consumes the measure and the
prose scale Pass 3 settles, and the `CreateTrigger` pattern Pass 2 built.

This is the pass where the owner has already made one call that reverses an
existing ADR: **domains leave `/settings` and become their own page.**

---

## The prompt

> Build **Pass 4 of the Dispatch refactor: the configuration surfaces**, on
> branch `design/impeccable`. Four surfaces, one of which does not exist yet.
>
> **Read first, in this order:**
> 1. `DESIGN.md` — the visual system. Accurate and normative.
> 2. `docs/adr/0044-list-rows-rest-and-create-is-a-header-action.md` — the
>    object-list pattern this pass applies to a new page: row names rest at 400,
>    create is a labelled `+ New …` in the header's action slot, the form is a
>    dialog, and standing `CollapsibleForm` furniture above the first row is
>    deleted.
> 3. `docs/adr/0011-health-books-cut-domains-live-in-settings.md` — **you are
>    reversing half of this.** Read the "Why" before you do.
> 4. `docs/adr/0014-ops-shell-day-schedule-link-ingest.md` and
>    `components/nav-links.ts` — the three-tier IA and what `/more` hosts.
> 5. `docs/adr/0041-the-iron-rules.md` and `CONTEXT.md`. Terminology is
>    load-bearing.
>
> **Scope:**
> - **`/domains` — a new route.** Owner's decision, described below.
> - `app/(authed)/settings/` — what remains after domains leave.
> - `app/(authed)/more/` — page and loading.
> - `components/capture-palette.tsx` (379 lines) and the shell controls only
>   these pages render: `push-toggle.tsx`, `theme-toggle.tsx`,
>   `sign-out-button.tsx`, `color-swatch-picker.tsx`, and
>   `collapsible-form.tsx` if anything still calls it when you are done.
>
> **Out of scope:** `/sign-in`, the error and not-found pages, `app-toaster.tsx`,
> `mention-input.tsx` and the PWA manifest — those are Pass 5. Every other
> surface is done; do not redesign it.
>
> ---
>
> ## The decision that is already made — domains become a page
>
> **This is settled by the owner and is not a gate.** `/settings` currently
> opens with domain management as its first and largest section: a
> `CollapsibleForm` create form, an active list, and an archived list, over
> `domain-row.tsx` at 195 lines. It is an object list wearing a settings
> section's clothes, and every other object list in the app now has a page.
>
> Build `/domains` as one: `PageHeader` with a measure, `+ New domain` in the
> action slot opening the dialog, `SectionHead` for the Active/Archived groups,
> rows on `ListRow` with names rested at 400 and the domain dot leading.
> Exactly the `/projects` and `/people` shape ADR-0044 established. Move the
> service reads with it; `listDomains(sb, { includeArchived: true })` already
> returns what the page needs.
>
> **Write an ADR that supersedes ADR-0011's domain half**, and state the reason
> the original merge no longer holds. ADR-0011 folded `/domains` into
> `/settings` because *"domains are configuration, not a daily destination — they
> belong next to the other knobs, freeing a tab for Notes"*, under a five-tab
> shell of Today / Notes / Projects / People / Settings. **That pressure is
> gone.** ADR-0014 replaced that shell: the tabs are Today / Tasks / Notes /
> Links / More, and everything else is hosted under `/more`. A route costs one
> line in `components/nav-links.ts` and no tab at all. The argument that
> justified the merge expired when the IA changed underneath it.
>
> Domains are also not only configuration any more, which is the other half of
> the reversal: a domain carries a colour that is data (`DESIGN.md`, "The Stored
> Slug Rule"), a cadence threshold, and a last-shipped date, and it is what
> `/tasks`, `/projects` and the day tape all colour themselves by.
>
> **Put it in `LIBRARY`, not `SYSTEM`** — it sits with Projects and People,
> which are the other things the app keeps records of, rather than with
> Notifications and Settings, which are knobs. Say so in the ADR, and update
> `MORE_SECTIONS` with it.
>
> ---
>
> ## Phase 0 — one gate
>
> ### What is left of `/settings`, and is it a page?
>
> Once domains leave, `/settings` is three small things: a web-push toggle, the
> app timezone, and the reminder offset/anchor. Roughly a screen and a half of
> controls with nothing to scan.
>
> `/more` is, today, a menu of destinations plus an account footer — theme
> toggle, the signed-in email, sign out. Also small, and also mostly chrome.
>
> Two thin pages that are both "the rest of the app" is worth questioning once,
> now that the thing that made `/settings` substantial has moved out. The
> options, and none is obviously right:
>
> - **They stay two pages.** `/more` is navigation, `/settings` is
>   configuration, and a menu that also holds toggles is a menu that has stopped
>   being one. The cost is a route with four controls on it.
> - **They merge into `/more`.** Destinations, then the knobs, then the account
>   footer — one place for everything that is not a daily surface, which is what
>   `/more` already claims to be. The cost is a longer page and a `Settings`
>   entry in the nav that points at an anchor rather than a route.
> - **They merge the other way**: `/settings` absorbs the account footer and
>   `/more` stays purely a phone-side destination list. Note that `/more` exists
>   because a phone has no room for the desktop rail — on desktop it is already
>   half-redundant with the header's tab group.
>
> Draw **two or three static comps** in `.impeccable/mocks/`, following
> `.impeccable/mocks/README.md` conventions. Desktop and phone, light and dark.
> Show the real inventory under each option — the four settings controls, the
> twelve `/more` destinations in their three groups, and the account footer.
> Include `/domains` in one comp so the new page can be seen beside the pages it
> is leaving.
>
> Then **stop and show me.** Do not build past this line until I pick.
>
> ---
>
> ## Phases 1–4 — after I pick
>
> Commit at the end of each phase; do not bundle them.
>
> 1. **`/domains`.** The new route, its `loading.tsx`, the create dialog, the
>    rows. `domain-row.tsx` moves and gets the ADR-0044 treatment. Keep every
>    affordance it has: edit, archive, mark-shipped, the cadence reading, the
>    last-shipped date, and the colour picker's "None" option with its
>    `null`-clearing behaviour, which `lib/form-decode.ts` depends on.
>    `components/color-swatch-picker.tsx` renders the nine palette slugs and must
>    keep resolving them through `var(--domain-<slug>)` — never a hex.
>
> 2. **`/settings` and `/more`, per the chosen option.** The remaining four
>    settings controls get the field rhythm from `components/ui/field.tsx`. The
>    last five mono eyebrow group labels in the app are here — `Domains`,
>    `Archived domains`, `Notifications`, `App`, and `/more`'s three section
>    titles — and they become `SectionHead`, which is where Pass 2 put every
>    other group label.
>
> 3. **The capture palette.** `components/capture-palette.tsx` is the fastest
>    path in the app (⌘J, and the dock's `+`), it is reachable from every
>    surface, and **no pass has designed it.** It carries its own idioms —
>    mono eyebrow labels, hand-rolled ink capsules, its own overlay — none of
>    which came from `components/ui/dialog.tsx`.
>
>    Bring it onto the system: `Dialog` for the overlay if it fits, `Button` for
>    the capsules, `Field` for the input. **What must not change is the capture
>    contract** — iron rule #4. Capture is text-only, persists first, and
>    degrades to a `needs_review` note rather than dropping input. The verb
>    vocabulary (ADR-0008, ADR-0016, ADR-0023) and the palette bus
>    (`lib/capture/palette-bus.ts`) are behaviour. If a visual change seems to
>    require touching either, stop and say so.
>
> 4. **Sweep.** Screenshot `/domains`, `/settings`, `/more` and the palette in
>    both themes at both widths, plus `/tasks` and `/today` to confirm the
>    domain colour still resolves everywhere it is read. Then update `DESIGN.md`
>    and land the domains ADR.
>
> ---
>
> **Constraints that outrank everything above:**
> - The six iron rules (ADR-0041). **Rule #4 is the live one**: nothing in the
>   capture path may throw instead of degrading.
> - **A domain's colour is a stored palette slug, never a hex** (ADR-0042 era,
>   `DESIGN.md`, "The Stored Slug Rule"). The row, the picker and the dot all
>   resolve through `var(--domain-<slug>)`.
> - **Do not retune the domain palette.** It meets three measured floors in both
>   themes; change it in `.impeccable/mocks/palette-lab.html` and re-measure, or
>   leave it alone.
> - **Do not redesign any surface from Passes 0–3.**
> - **Mobile is a responsive layer, not a fork.** One component tree.
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
> Do not merge to `main`. The branch merges in one go when all passes land.

---

## Why the domains move is a reversal worth recording properly

ADR-0011 deleted a `/domains` page that already existed and moved its contents
into `/settings`. Restoring it without saying why would leave two ADRs
disagreeing and no way to tell which is current.

The honest version is that ADR-0011's reasoning was correct for its shell and
expired with it. It traded a route for a tab under a five-tab IA where every
destination had to be a tab or be unreachable on a phone. ADR-0014 replaced that
with a More-hosted model, and under that model the trade does not exist. This is
not "the old decision was wrong" — it is "the constraint it optimised against is
gone", which is the more useful thing for the next reader to know.

## Why the settings/more question is a gate and not a build step

Because it only becomes askable now. While domains sat in `/settings`, the page
was substantial and no one would have merged it into a menu. Taking domains out
is what makes the remainder look thin, and the right moment to ask whether two
thin pages should be one is immediately after the thing that made one of them
thick has left.

## After this pass

**Pass 5 — the edges.** `/sign-in`, the error and not-found pages, the toaster,
the mention input, and the PWA chrome. See `.impeccable/BUILD-EDGES.md`.
