# Build brief — Pass 5, the edges

Paste the block below into a fresh Claude Code session at the repo root, on
branch `design/impeccable`. Everything it needs is on disk; it should not need
this file's prose.

**Passes 0–4 must be landed first.** This is the last pass, and the one that
closes the refactor: after it, nothing in the app is still wearing an idiom the
revision A identity replaced.

Its surfaces have one thing in common — **no pass owned them because none of
them is a page you navigate to.** They are the states the app is in when
something is wrong, loading, unauthenticated, or installed.

---

## The prompt

> Build **Pass 5 of the Dispatch refactor: the edges**, on branch
> `design/impeccable`. This is the final pass. Its job is to leave nothing in
> the app still composed in an identity that has been replaced.
>
> **Read first, in this order:**
> 1. `DESIGN.md` — the visual system, now carrying every rule Passes 0–4 added.
> 2. `docs/adr/0042-the-page-header-is-the-fine-locator.md` — the header, and
>    what it deleted. `/sign-in` never got the memo; it is the last surface in
>    the app still wearing the full legacy silhouette.
> 3. `docs/adr/0032-pwa-cold-start-session-recovery.md` and
>    `docs/adr/0025-session-refresh-runs-in-the-browser.md` — the sign-in
>    page's behaviour is load-bearing and is not yours to change.
> 4. `docs/adr/0041-the-iron-rules.md` and `CONTEXT.md`.
>
> **Scope:**
> - `app/sign-in/page.tsx` — the only unauthenticated UI in the app.
> - `app/not-found.tsx` (root, unauthenticated), `app/(authed)/error.tsx`,
>   `app/(authed)/not-found.tsx`.
> - `components/app-toaster.tsx` — the app's only feedback surface.
> - **The three suggestion popovers**, which are one object with three
>   implementations: `components/mention-input.tsx` (298 lines) and its popover,
>   plus `app/(authed)/notes/[id]/mention-suggestion.tsx` and
>   `wikilink-suggestion.tsx`. Pass 3 restyled the note editor around them but
>   left all three carrying the same hand-rolled
>   `rounded-control border border-line bg-surface … elevation-overlay` string.
>   They are unowned by any other pass.
> - The PWA chrome: `app/manifest.ts`, `app/layout.tsx`'s metadata and boot
>   scripts, `public/icons/*`, `components/sw-register.tsx`.
> - **The `.type-title` question**, described below.
>
> **Out of scope:** every page surface. Passes 0–4 own them and they are done —
> with **one narrow exception**, described under the `.type-title` decision
> below: two files under `/tasks` still carry that class, and a decision to
> retire it cannot be executed without touching them. That touch is a class
> swap and nothing else.
>
> ---
>
> ## Three things that are already wrong — fix them, they are not gates
>
> ### 1. The manifest is two identities out of date
>
> `app/manifest.ts` sets `background_color: "#0a0a0a"` and
> `theme_color: "#0a0a0a"`. That near-black is the **Vercel/Geist** ground from
> ADR-0013 — not the current dark token, which is the warm `#1a1817`, and not the
> current default, which is light at `#fafafa`. `app/layout.tsx`'s `themeColor`
> viewport export was updated during the revision A port and is correct; the
> manifest was missed.
>
> The visible consequence is the install splash and the OS task-switcher card
> render on a colour that exists nowhere in the app. A manifest cannot carry a
> media query the way the viewport export can, so pick the one that is right for
> a first launch and say why in a comment — the app is light by default, so the
> light ground is the honest answer.
>
> Check `public/icons/*` and the `apple-touch-icon` against the current brand
> mark while you are there (`components/brand-mark.tsx`, and the icon change in
> commit `5ebd756`).
>
> ### 2. The toaster boots dark
>
> `components/app-toaster.tsx` initialises `useState<"dark" | "light">("dark")`
> and corrects itself in an effect. Light has been the default since Pass 0, so
> the first toast after hydration can flash the wrong theme. It should default
> to light, matching `THEME_BOOT` in `app/layout.tsx`, which resolves anything
> that is not the string `"dark"` to light.
>
> The toaster also carries hand-rolled `classNames` that predate the primitives.
> Bring them onto the system — and note it is the one surface that speaks to the
> reader in the app's own voice while something has gone wrong, so its copy and
> its ink deserve the same attention as an `EmptyState`.
>
> ### 3. `/sign-in` still wears the silhouette ADR-0042 deleted
>
> Mono eyebrow, a title, and a `hairline-strong` divider beneath — the exact
> three-part stack removed from fourteen surfaces in Pass 0. It survived because
> it is outside `(authed)` and every sweep was scoped to the shell.
>
> It cannot use `PageHeader` as-is: there is no app shell here, no tab group, no
> dock, and the page is a centred column at `max-w-sm` rather than the 72rem
> frame. Decide what the header *is* on a page with no shell around it, and make
> that a considered answer rather than an inherited one. The brand mark has a
> real claim to the space — it is the only place in the product where the app
> introduces itself.
>
> **Its behaviour is not yours to touch:** the `checkingSession` gate, the
> recovery client, and the redirect contract come from ADR-0025 and ADR-0032,
> and `proxy.ts` keeps `/sign-in` outside the matcher specifically so that
> recovery can refresh without a redirect loop.
>
> ---
>
> ## Phase 0 — one gate
>
> ### What the app says when something has gone wrong
>
> Four surfaces tell the reader that the thing they wanted is not there:
> `app/(authed)/error.tsx`, `app/(authed)/not-found.tsx`, `app/not-found.tsx`,
> and the toaster. They were migrated mechanically in Pass 0 — they got the new
> header and stopped using the deleted class — but **none of them has ever been
> designed**, and they do not agree with each other on voice, on what to offer
> next, or on how much of the page to take.
>
> They also sit against a system whose empty states already have an answer.
> `EmptyState` says a thing is absent in a left-aligned italic with an upright
> hint beneath, deliberately quiet, on the same edge as the content it stands in
> for. An error is not an empty — something failed rather than not existing yet
> — but the two are close enough that the difference should be a decision.
>
> Decide the register for failure, and how far it is allowed to sit from the
> register for absence. Then apply it to all four, plus the two hand-built
> `Suspense` fallbacks in `notes/[id]` — `EditorFallback` and
> `LinkSectionsFallback`, which Pass 3 left as bespoke pulse bars while every
> route-level loading state in the app went through `PageSkeleton`. They are
> waiting rather than failing, so they may well keep their own shape; what they
> should not keep is being the only two that were never asked.
>
> Draw **two or three static comps** in `.impeccable/mocks/`, per
> `.impeccable/mocks/README.md`. Desktop and phone, light and dark. Show all
> four states under each option, plus one `EmptyState` beside them so the
> distance between "absent" and "broken" is visible rather than argued.
>
> Then **stop and show me.** Do not build past this line until I pick.
>
> ---
>
> ## Phases 1–4 — after I pick
>
> Commit at the end of each phase; do not bundle them.
>
> 1. **The failure states**, per the chosen option: the three route-level pages
>    and the toaster. `error.tsx` keeps logging the raw error to the console and
>    keeps it out of the UI — it may carry provider or network wording. The
>    `reset()` contract stays.
>
> 2. **`/sign-in` and the unauthenticated frame.** Header per the decision
>    above, `Field`/`Input`/`Button` throughout — most of it is already on the
>    primitives, so this is the header, the divider, the `checkingSession` state
>    and the error line. Both themes: this page is the first thing rendered on a
>    cold install, before any cookie exists.
>
> 3. **The three suggestion popovers.** `mention-input.tsx` (used by the task
>    dialog and the capture palette) and the note editor's
>    `mention-suggestion.tsx` and `wikilink-suggestion.tsx`. All three draw the
>    same floating list from the same hand-rolled string, and all three have the
>    same empty state. They are the last unsystematised overlay in the app.
>
>    Decide whether they become one shared primitive or stay three files sharing
>    one style — three callers is the threshold ADR-0044's `ListRow` used, so
>    the evidence is there if the behaviours actually match. They may not: the
>    mention popover filters people, the wikilink popover filters note titles and
>    can offer to create, and `mention-input` owns caret-driven state the other
>    two get from TipTap. **If the state models differ, share the styling and not
>    the component** — that is the same call `day-row` and `task-row` made.
>
>    The `@mention` contract (ADR-0030) and the wikilink resolution are
>    behaviour — restyle the surface, not what they match or emit.
>
> 4. **The PWA chrome, `.type-title`, then the closing sweep.**
>
>    **The `.type-title` decision.** Pass 2 took it off list rows, Pass 3 took it
>    off the editor title and chat prose, and Pass 4 took it off the domain row
>    as that row moved to `/domains`. Verify against the tree rather than this
>    list; as of the end of Pass 3 the survivors were:
>
>    | File | What it is |
>    |---|---|
>    | `app/sign-in/page.tsx` (×2) | the h1 and the "Checking session…" line — yours, phase 2 |
>    | `components/capture-palette.tsx` (×2) | the verb label and the compose field — Pass 4's |
>    | `app/not-found.tsx` | the root 404's h1 — yours, phase 1 |
>    | `app/(authed)/settings/domain-row.tsx` | moves to `/domains` in Pass 4 |
>    | `app/(authed)/tasks/task-fields.tsx` | the dialog's title field |
>    | `app/(authed)/tasks/task-note-popover.tsx` | the note preview's body |
>
>    **The last two are the reason this pass may touch `/tasks`.** They are a
>    finished surface, but the class cannot be retired while two call sites hold
>    it, and neither belongs to any remaining pass. Swap the class; change
>    nothing else in those files, and say so in the commit.
>
>    Either the class still names something real, or it is one declaration behind
>    a name that its call sites use for three different reasons — a form field, a
>    popover body, an h1 — and it should be inlined and deleted. `.font-serif` is
>    the cautionary tale: a class that outlived its meaning made every page under
>    it look plausible for two identities. **Decide it deliberately and record the
>    answer either way** — including "it stays, and here is what it means", which
>    is a real outcome.
>
>    Then the closing sweep. Screenshot **every** surface in the app in both
>    themes at both widths. Grep for what should no longer exist:
>    `hairline-strong pb-4`, `font-serif`, the mono eyebrow above any heading,
>    any `text-2xl`/`text-3xl`/`text-xl` that is not the documented prose scale.
>    **And:** every responsive override resets what it needs to — the More menu
>    defect in Pass 4.5 (phone `max-h` leaking into the desktop popover) is
>    exactly the class of bug a mobile-first cap produces when a desktop variant
>    forgets to reset it.
>
>    **And:** every `first:` / `last:` variant is on an element that really is
>    the first or last child. Pass 4.5 shipped three dead `first:mt-0`s — a
>    `PageHeader` held `:first-child` on two pages and an `sr-only` label held it
>    inside the More menu's `nav`, so the cancellation never fired and the first
>    section sat 36px lower than on every other page. Both bugs in that pass were
>    variants that silently do not apply, which no grep for a class name catches:
>    read the computed value, not the class list.
>
>    **Audit the ADR record before regenerating anything.** Every gate is
>    supposed to have one, and one is missing: **Pass 3's gate (W2) was never
>    written up.** Its decisions — the 65ch prose measure, authored prose staying
>    on the closed ramp rather than gaining 24/20, the note editor's column +
>    rail, the chat speaker registers, and the note editor declining `PageHeader`
>    — landed in `DESIGN.md` and in the commit message of `57495e8`, with no ADR
>    beside 0042, 0043 and 0044. `DESIGN.md` states the rules; nothing states the
>    options that lost or why. Write it (next number after Pass 4's domains ADR),
>    sourcing it from `.impeccable/mocks/writing-lab.html` and that commit while
>    both still mean something.
>
>    Then regenerate `DESIGN.md` with `/impeccable document` and write the
>    closing ADR: what the passes changed, what they deleted, and which decisions
>    are now load-bearing for anything built next.
>
> ---
>
> **Constraints that outrank everything above:**
> - The six iron rules (ADR-0041).
> - **Do not touch session behaviour.** The `checkingSession` gate, the recovery
>   client, `components/session-keeper.tsx`, `proxy.ts`'s matcher, and the
>   `/sign-in` exemption in it are ADR-0025 and ADR-0032. A visual pass does not
>   move the auth boundary.
> - **Do not touch the service worker's caching rules.** `public/sw.js` never
>   caches authed HTML, and `app/(authed)/not-found.tsx` documents why its
>   status code is 200 and cannot be otherwise.
> - **Do not redesign any surface from Passes 0–4.**
> - **Mobile is a responsive layer, not a fork.** One component tree.
> - **Do not "fix" the `--ink-3` / `--ink-4` contrast** (`DESIGN.md`, "The
>   Recorded Contrast Tradeoff").
> - Compose `components/ui/` primitives; no raw hex in app code; Lucide only;
>   honour `prefers-reduced-motion`.
> - Biome lint, Biome format and `tsc --noEmit` clean before every commit.
>   Conventional commits.
>
> **Verify in the browser, not by assertion.** Use the `dispatch` entry in
> `.claude/launch.json`. For the manifest and icons, verify installed or with
> devtools' Application panel — a screenshot of the page will not show either.
>
> **When this pass lands, the branch merges to `main` in one go.**

---

## Why these surfaces were left for last, and why they still matter

Every one of them is a state rather than a destination, so none of them appeared
in a pass scoped by route. That is also why they rot quietly: `/sign-in` kept a
silhouette three identities old because nobody navigates to it while working,
and the manifest kept a colour from a rejected design system because it is never
on screen during development.

They are, however, the app's first impression and its worst moments. The
manifest colour is what the reader sees before the app has painted anything; the
sign-in page is the whole product on a fresh install; the toaster is the only
thing that speaks when something has failed. Leaving them is the difference
between a refactor that shipped and one that shipped everywhere.

## What "done" means

After this pass, the following should be true, and the closing sweep should
prove each one rather than assert it:

- No surface uses `hairline-strong pb-4`, `font-serif`, or a mono eyebrow above
  a heading.
- Every route-level page renders `PageHeader` or has a recorded reason not to
  (`/today`, `/sign-in`, and whatever Pass 3 decided for `/notes/[id]`).
- Every type size in the app is a documented ramp step or a documented prose
  step.
- Every colour in app code resolves through a token; no hex outside
  `globals.css` and the palette lab.
- `DESIGN.md` describes the app that exists, and every decision that took a gate
  has an ADR.
