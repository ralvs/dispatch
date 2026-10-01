# Pages behind More carry a way back

Date: 2026-10-01

On a phone, eight pages are reached through the More menu: the Library
(`/projects`, `/journal`, `/routines`, `/quotes`, `/people`, `/domains`), the
System pages (`/notifications`, `/settings`) and `/chat`. Once there, nothing on
the page leads back. The detail pages have a mono breadcrumb (`← Notes`,
`← Projects`, `← People`); these pages had none (issue #53).

More is a menu, not a route (Pass 4 / C4). There is no `/more` page to link to.

## Decision

1. **Every page `MORE_SECTIONS` lists carries `← More` above its header.** It
   is a button styled as the breadcrumb, and it opens the More menu through
   the existing bus (`lib/more-menu-bus.ts`). The owner chose it: the way back
   is the list you came from, which is the menu.
2. **Shown at every width.** The desktop header opens the same menu, so the
   control means the same thing everywhere. One rule, no breakpoint.
3. **One component per shape.** `BackLink` (`components/ui/back-link.tsx`) is
   the detail pages' `← List` link; `MoreBackLink` is the menu button. Both
   share one class string. The three detail pages stop restating it.
4. **It sits above the page's Suspense boundary**, so it comes out of the
   prerendered shell, like the detail pages' breadcrumb. It holds no portal:
   it dispatches an event, and the menu's portal stays in the shell (ADR-0062
   D4).

## Consequences

- The breadcrumb is no longer only a detail-page affordance. DESIGN.md "Page
  Header" now states where it appears.
- `← More` is a button, not a link: it has no URL, so it cannot open in a new
  tab. Accepted — the menu has no URL either.
- A page added to `MORE_SECTIONS` must render `MoreBackLink`.
  `test/e2e/more-back-link.spec.ts` walks `MORE_HOSTED_HREFS`, which
  `components/nav-links.ts` derives from `MORE_SECTIONS`, so a miss fails the
  suite.
