# The server moved to the database, and the shell paints before the cookie

Date: 2026-09-20

Amends [ADR-0033](./0033-cache-components-and-tagged-data.md) Decision 3 (the
authed shell's Suspense) and narrows nothing else. Everything in
[ADR-0034](./0034-the-client-owns-navigation-freshness.md) and
[ADR-0035](./0035-tags-are-for-query-cost-not-for-navigation.md) stands.

## Context

The app was slow to open and worse to come back to. Three causes, found by
measuring rather than reading:

1. **`vercel inspect` showed every function built for `iad1`.** Supabase is
   `sa-east-1` and the only user is in Brazil. So each page was: browser →
   `gru1` edge → function in Virginia → database in São Paulo and back. Today
   does two to three waves of queries; that is most of a second spent purely
   in transit before any work happens.
2. **`expire` was 600s on the Today digest and 900s on tasks/notes/links.**
   Ten minutes away and the whole fan-out ran again, behind a skeleton.
3. **The prerendered shell of every authed route was the word "Loading".**
   `AuthedShell` awaited `requireOwnerPage()`, so the header, the dock, the
   frame and the palettes were one dynamic hole. PPR had nothing to serve.

Ideas were taken from `pingdotgg/t3code` (`apps/web`), a Vite SPA whose
navigation is fast because it never renders on a server per navigation. That
architecture does not transfer. Four of its techniques do, and three are here:
prefetch on intent (`defaultPreload: "intent"`, `apps/web/src/router.ts`),
per-route code splitting, and React Compiler. The fourth — an inline boot
script that paints the themed shell before React mounts — Dispatch already had
as `THEME_BOOT` (ADR-0033 Decision 2).

## Decisions

1. **Functions run in `gru1`.** `vercel.json` sets `regions: ["gru1"]`. This
   is a latency decision, not a preference: the region must follow the
   database, which is `sa-east-1`. A Supabase region change makes this wrong.
   The Vercel dashboard's Function Region setting can override the file, so
   the check after a deploy is the built output, not the config:

   ```
   vercel inspect dispatch.alves.id | grep -m5 'λ'
   ```

   It must print `[gru1]`. Verified live 2026-09-21. Database round trip
   ~230ms → ~5ms.

2. **One `tagged` cacheLife profile, and the clock is not what keeps it
   honest.** `next.config.ts` defines `tagged` as `stale 300 / revalidate 3600
   / expire 604800`, and all five readers in `lib/cache/*` use it. The
   correctness argument is ADR-0035's: every in-app write goes through
   `afterMutation` and every cron or external write through
   `afterExternalMutation`, and both call `revalidateTag(tag, "max")`. A short
   `expire` therefore bought no freshness at all — only a guaranteed slow
   return. `revalidate: 1h` is the lever that matters: past an hour Next serves
   the stale entry and refreshes behind the response, so nobody waits.

   The cost is that a **missing tag is now visible for up to a week instead of
   ten minutes.** One such gap existed and is fixed: `notes.write` busts
   `today-digest` as well, because `loadTodayDigest` counts `needs_review`
   notes. Before adding a cached reader, name every write that moves its data.

3. **The authed shell is static; the owner check is a hole inside it.**
   Supersedes ADR-0033 Decision 3. `AuthedShell` is synchronous and
   prerenders; `OwnerGate` is an async component that awaits
   `requireOwnerPage()`, renders `null`, and sits in its own `<Suspense>`.

   This does not weaken iron rule #2. The frame is the same markup on every
   route and carries no data; `proxy.ts` still redirects unauthenticated page
   navigations; and every page under `app/(authed)/` still awaits
   `requireOwnerPage()` before its own first read — which is where the
   boundary has always actually been. Confirmed by an independent reviewer
   before merge.

   `usePathname` is dynamic data under Cache Components on a dynamic route, so
   `AppHeader` and `BottomTabBar` split into a view taking `pathname` and a
   client wrapper supplying it. The layout prerenders the view with
   `pathname={null}` as the Suspense fallback. `isActive` returns false for
   null, so nothing is lit rather than the wrong thing.

   Shells went from the word "Loading" to the full frame at 12K, served from
   the CDN.

4. **A portal target must not sit inside a Suspense boundary.** `CapturePalette`
   portals its button into `#dock-action-slot` from an effect as soon as the
   shell hydrates. With the slot inside the tabs' boundary, React hydrated that
   boundary against a slot the portal had already filled; hydration failed, and
   every page whose body is one dynamic hole sat on its `loading.tsx` forever.
   `BottomTabBarFrame` now owns the rail and the slot outside the boundary.

   The failure mode is worth remembering because it does not look like a
   hydration bug — it looks like a slow server.

5. **Nav links prefetch on intent, not on viewport.** `components/intent-link.tsx`
   keeps Next's cheap `auto` prefetch and upgrades to a full one on hover,
   first touch or focus. `prefetch={true}` on five tabs would fire five full
   page renders on every page load — the cold-start burst ADR-0032 is about.
   This is the stable spelling of Next's `unstable_dynamicOnHover`, which is
   not on the public `next/link` type.

   The warm handlers are pulled out of `...rest` and composed, not spread over:
   a caller passing `onMouseEnter` would otherwise silently switch prefetch off.

6. **React Compiler is on.** `reactCompiler: true`. Verified in the output
   rather than assumed — 133 generated memo-cache sites in the client chunks.

7. **A heavy client tree that most visits never open loads on demand.**
   `DatePicker` and `TimePicker` are react-aria-components plus
   `@internationalized/date`, ~435 KB, and their only consumer is the task
   form inside `Dialog`, whose children mount only while it is open. They are
   `next/dynamic` with `ssr: false`, and `components/ui/index.ts` no longer
   re-exports them — the barrel has 79 import sites, and re-exporting them is
   how that weight reached every route. `/tasks` client JavaScript 1685 KB →
   1310 KB.

8. **Redirect-only pages are config redirects.** `/` and `/more` were pages
   whose entire body was `redirect()`. Config redirects run in the routing
   phase, ahead of the proxy, so they cost no function invocation and no
   `getClaims()` pass. Both are 307: a 308 is cached by the browser forever and
   `/` should stay re-pointable. `/more` remains a sentinel `href` on a button
   in `components/nav-links.ts` and is never navigated to.

## Deliberately not done

Each of these was considered and rejected with a reason, so a future pass does
not spend the same hours re-deciding them.

- **Luxon stays in the client bundle (72 KB).** Getting it out means splitting
  `lib/dates.ts`, and iron rule #1 makes that file the single home of date
  logic — the file itself refuses a micro-optimization to hold the line.
  Worse, the functions clients actually call are `formatDay` and
  `formatInstant`, which take Luxon format strings (`"cccc, d LLLL yyyy"`).
  Reimplementing a format-string parser to save 4% is how dates start
  disagreeing with themselves.

- **`NoteEditor` stays statically imported.** Deferring the editor on the page
  whose whole purpose is the editor only adds a round trip before you can type.

- **`SessionKeeper` still constructs the browser Supabase client eagerly**
  (220 KB on every route). Deferring it would delay the refresh ticker past
  hydration, and ADR-0025 and ADR-0032 are explicit that the browser has to
  refresh ahead of the request fan-out. That bug cost more than 220 KB is
  worth.

- **`SoftRefresh` still calls `router.refresh()` on a 5-minute interval**,
  which per ADR-0034 fact #2 expires the client router cache for every route.
  Routing around it means rebuilding Today's refresh on
  `loadDayScheduleAction`, and the same RSC re-render also updates the
  counters, the masthead badge and `todayIso` for the midnight rollover guard
  in `day-view.tsx` — a naive swap fixes the bands and quietly stops updating
  all of that. In steady state `staleTimes.dynamic` is 300s and the tick is
  300s, so the wipe lands on entries that were about to expire anyway, and the
  re-read behind it is now a cache hit 5ms from the database. **This was
  judged, not measured.** If it is revisited, measure first.

## Consequences

- The region is now part of the deploy contract. A Supabase region change, or
  a dashboard Function Region setting, silently undoes the largest win here.
- A cached reader whose tag is not busted by some write path is wrong for up
  to a week. `lib/mutation-feedback/invalidate.test.ts` asserts the live tags
  are named by the writes that move their data; extend it with each new reader.
- Prerendered shells mean a client component in the layout is now hydrated
  from prerendered HTML rather than client-rendered from a stream. Anything in
  the frame that reads `window`, a portal target, or the clock during render
  is a hydration mismatch waiting to happen — and it presents as a page stuck
  on its skeleton, not as an error the user can see. The dev server log prints
  the readable diff; the production build only gives minified React error #418.
- React Compiler adds build time and assumes components do not mutate during
  render. The 890-test suite and a manual pass over the capture palette, the
  task dialog and client-side navigation were the check.
