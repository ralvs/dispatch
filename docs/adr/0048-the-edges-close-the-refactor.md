# The edges close the refactor

Date: 2026-08-09

Final pass of the revision-A identity. Gate: `.impeccable/mocks/edges-lab.html`
(option **B · Page**). Closes the work opened by ADR-0042 through ADR-0047.

## Context

Passes 0–4 redesigned every navigable surface. What remained were states
rather than destinations — wrong, loading, unauthenticated, installed — and
they still wore idioms the revision replaced: the mono-eyebrow + hairline
silhouette on `/sign-in` and the root 404, a Vercel/Geist near-black in the
manifest, a toaster that booted dark, three hand-rolled suggestion panels,
and a `.type-title` class that had outlived a single meaning.

## Decision

### Failure register — B · Page

Failure owns the route. Distance from absence (`EmptyState`) is structural:

| State | Register |
|---|---|
| **Broken (fault)** | `PageHeader` + plain operational English + primary recovery (`error.tsx`) |
| **Broken (missing)** | `PageHeader` + quiet nav pills; no error colour (`(authed)/not-found`) |
| **Broken (root 404)** | Unauth frame: brand mark + Title-step h1; no eyebrow, no hairline |
| **Toast** | Surface card, medium title, error border; light default (matches `THEME_BOOT`) |
| **Absent** | `EmptyState` unchanged — left-aligned italic, upright hint |
| **Waiting** | `PageSkeleton` on routes; note Suspense pulses keep content shape (no `PageHeader` to hold) |

Options that lost:

- **A · Near** — failure as EmptyState italic. Under-announced a crashed route.
- **C · Signal** — B plus a 2px error rule on fault. Spent error colour on
  chrome the product otherwise refuses; not-found is missing, not fault.

Copy is plain: "Couldn't load", "Nothing here". "Something went sideways" is
gone.

### Unauthenticated frame

`/sign-in` and the root 404 share one intro: brand mark + wordmark, then a
page-weight title. The three-part legacy stack (mono eyebrow, title, hairline)
is deleted from the last surfaces that still wore it. Session recovery
behaviour is unchanged (ADR-0025, ADR-0032).

### Suggestion surface

Three callers (`mention-input`, note `@` mention, note wikilink) share
`suggestionPanel` / `suggestionEmpty` / `suggestionOption` — style only. State
models differ; no single component (same call as day-row / task-row).

### `.type-title` retired

The class set weight 500 and tracking −0.02em. Call sites used it for three
different reasons (form field, popover body, h1) — the same drift that made
`.font-serif` look plausible across three identities. Remaining sites inline
`font-medium tracking-tight`; ramp steps already carry weight. Task note
popover body drops the weight (it was prose).

### PWA chrome

Manifest `background_color` / `theme_color` are the light ground `#fafafa` —
the app default. A manifest cannot media-query; the viewport export still
follows OS scheme. Icons regenerated from `BrandMark`.

## What the passes deleted (load-bearing for anything built next)

- The mono eyebrow above a heading
- The second title under a page name
- The hairline under a page header
- `.font-serif` and then `.type-title`
- Centred linen-era empties
- Near-black manifest splash
- Hand-rolled suggestion panel strings
- Route loading headers copied by hand (→ `PageSkeleton`)

## What they settled (do not re-open without a gate)

- **PageHeader** is the fine locator (ADR-0042); exceptions: `/today`,
  `/notes/[id]`, `/sign-in` (unauth frame, not the shell header)
- **Capture is the plus** (ADR-0043)
- **List rows rest at 400; create is a header action** (ADR-0044)
- **Domains are a Library page; More is a menu** (ADR-0045)
- **Header facts vs measure; section rhythm 36px** (ADR-0046)
- **Prose 65ch; authored scale closed; note column + rail** (ADR-0047)
- **Failure is a page; absence is a slot; waiting is geometry** (this ADR)

## Consequences

`DESIGN.md` describes the app that exists. Every gate from Pass 0 onward has
an ADR. The branch is ready to merge; nothing in the app should still be
composed in a replaced identity.
