# The app shell owns the viewport, and every route gets a loading boundary

Date: 2026-07-27

## Context

Two complaints arrived together, and they turned out to share a root: nothing
in this app ever claimed the viewport.

**Navigation felt slow even on the second visit.** The measurement was blunt:
there was not one `loading.tsx`, `error.tsx`, or `<Suspense>` boundary in the
entire `app/` tree, and zero occurrences of `export const dynamic`,
`revalidate`, `unstable_cache`, or `"use cache"`. Every authed route is dynamic
— the `(authed)` layout calls `cookies()` and `requireOwnerPage()`, which opts
the whole subtree in. Next's default prefetch on a dynamic route fetches only
*down to the nearest loading boundary*. With no boundaries anywhere, prefetch
returned nothing, so every tab tap was a full server round-trip with a blank
interval. The shell was doing no work in advance because we had never given it
a place to stop.

**The mobile bottom bar sat slightly above the true bottom on short pages.**
`BottomTabBar` was `fixed inset-x-0 bottom-0`, which pins to the viewport — so
on its face it should have been flush. But `min-h-screen`/`min-h-dvh` appear
nowhere in the authed tree, and `globals.css` gave `body` only
`padding-top: env(safe-area-inset-top)`. On a page with little content nothing
scrolls, so mobile Safari keeps its bottom toolbar expanded and `bottom: 0`
resolves to the top of *that toolbar*, not the screen. The bar rode up exactly
when the page was short — which is what was reported.

The same absence produced a third, quieter problem: three magic numbers had to
be hand-synced across three files — `<main>`'s `pb-28`, the capture FAB's
`6rem` offset, and the bar's own rendered height. Nothing enforced their
agreement.

## Decision 1 — a `loading.tsx` per route segment

One in every segment under `app/(authed)/`, plus the three dynamic children.
This is what makes prefetch do anything at all; it is the highest-impact change
in the round and the cheapest.

Each skeleton renders the page's **real** static header — the eyebrow and the
serif `<h1>` are known at build time, so faking them with grey bars would be
strictly worse — above pulsing placeholder rows at that page's rhythm.

## Decision 2 — the shell is a flex column of `100dvh`

`<main>` becomes the scroll container (`flex-1 overflow-y-auto
overscroll-contain`) and the bottom bar returns to normal flow as the last
flex child. A bar that is a sibling in a full-height column cannot ride up,
because it is no longer negotiating with the browser's chrome for what
`bottom: 0` means.

`pb-28` and the FAB's `6rem` both disappear: the bar's height is now whatever
it is, and the flex column absorbs it. The bar keeps
`pb-[env(safe-area-inset-bottom)]` for the home indicator.

This is the change in the round with the widest blast radius — it moves scroll
from the document to an element, which affects scroll restoration and any
`position: sticky` measured against document scroll.

## Decision 3 — Alt/Option+1..5, not Cmd+1..5

The owner asked for Cmd/Ctrl+1..5. Those are reserved by Chrome and Safari for
tab switching and cannot be intercepted by a page — they would have worked only
in the installed PWA, where there are no tabs. Alt+1..5 works in both.

The binding matches on `e.code` (`Digit1`…`Digit5`), never `e.key`: on macOS
`Option+1` emits `¡`, so a `e.key === "1"` check silently never fires. The
predicate lives in `lib/capture/shortcuts.ts` beside the existing Cmd+J one and
is unit-tested against the `¡` case specifically.

## Decision 4 — stop wiping the router cache on every theme change

`lib/mutation-feedback/invalidate.ts` called `revalidatePath("/", "layout")`,
which discards every prefetched segment app-wide. That is correct for a
timezone change, which really does alter every rendered date. It is not
correct for a theme change, which is a cookie and a class — and it would have
undone Decision 1 several times an hour.

## Consequences

- Tab taps paint a skeleton immediately instead of blocking on the RSC
  response. `/today` additionally streams: its shell renders before the ~13
  query fan-out in `loadBriefingChrome` resolves.
- Pages scroll inside `<main>` rather than the document. Anything relying on
  document scroll must be re-checked; `position: sticky` inside a page now
  sticks to the scroll container, which is usually what was wanted anyway.
- In the installed PWA (standalone, no browser toolbar) the bottom-bar bug did
  not occur at all. This fix matters for in-browser use, and costs the PWA
  nothing.
- **Deferred, and it is the next real win:** `proxy.ts` calls
  `supabase.auth.getUser()` — a network hop to Supabase — on *every* matched
  request including RSC segment fetches, and `requireOwnerPage()` then calls it
  again during render. `getClaims()` verifies the JWT locally instead, but only
  avoids the hop once the project is rotated to asymmetric signing keys. ADR-0003
  already declares the proxy UX-only and `requireOwner()` the real boundary, so
  the security posture would be unchanged. Blocked on the key rotation, not on
  the code.
- Rejected: caching authed HTML/RSC in `public/sw.js` (private data surviving
  sign-out); `unstable_cache`/`"use cache"` over the briefing (staleness risk
  against the UTC/timezone rules exceeds the win — revisit with `cacheTag` now
  that the boundaries exist); `prefetch={true}` on nav links, which forces a
  full server render per visible link and is made unnecessary by Decision 1.
