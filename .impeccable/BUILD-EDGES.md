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
> - `components/mention-input.tsx` (298 lines) and its suggestion popover.
> - The PWA chrome: `app/manifest.ts`, `app/layout.tsx`'s metadata and boot
>   scripts, `public/icons/*`, `components/sw-register.tsx`.
> - **The `.type-title` question**, described below.
>
> **Out of scope:** every page surface. Passes 0–4 own them and they are done.
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
> register for absence. Then apply it to all four, plus the two `Suspense`
> fallbacks in `notes/[id]` if Pass 3 left them hand-built.
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
> 3. **`mention-input.tsx` and its popover.** 298 lines, used by the task dialog
>    and the capture palette, and its suggestion list is the last hand-rolled
>    popover in the app once Pass 3 has restyled the editor's two. The `@mention`
>    contract (ADR-0030) is behaviour — restyle the surface, not what it matches
>    or emits.
>
> 4. **The PWA chrome, `.type-title`, then the closing sweep.**
>
>    **The `.type-title` decision.** Pass 2 took it off list rows, Pass 3 took it
>    off the editor title and chat prose, and Pass 4 took it off the domain row.
>    Whatever is left — forms, `/sign-in`, the capture palette — is few enough to
>    look at as a whole. Either it still names something real, or it is one
>    declaration behind a class that three of its call sites use for three
>    different reasons, and it should be inlined and deleted. `.font-serif` is
>    the cautionary tale: a class that outlived its meaning made every page
>    under it look plausible for two identities. **Decide it deliberately and
>    record the answer either way** — including "it stays, and here is what it
>    means", which is a real outcome.
>
>    Then the closing sweep. Screenshot **every** surface in the app in both
>    themes at both widths. Grep for what should no longer exist:
>    `hairline-strong pb-4`, `font-serif`, the mono eyebrow above any heading,
>    any `text-2xl`/`text-3xl`/`text-xl` that is not the documented prose scale.
>    Regenerate `DESIGN.md` with `/impeccable document` and write the closing
>    ADR: what the five passes changed, what they deleted, and which decisions
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
