# Code lives with its only consumer

Date: 2026-10-02

`/today` imported from `../tasks/` and `../routines/`, so the Tasks route had
become a shared module by accident. Seven components in `components/` had one
consumer each. The palettes in `components/` imported server actions from
`app/(authed)/capture/` and `app/(authed)/find/`, two folders with no page. And
`lib/` mixed flat modules with folders that held one module each (#35).

## Decision

1. **Route-private code lives in its route folder.** A component, action or
   helper that one route uses sits next to that route's `page.tsx`. A nested
   route (`notes/[id]`) may import from its parent route's folder.
2. **No route imports from another route's folder.** When a second route
   needs something, it moves out:
   - components → `components/` (for example `task-dialog.tsx`,
     `task-fields.tsx`);
   - server actions → `lib/actions/` (`tasks`, `routines`, `capture`, `find`);
   - types and pure logic → `lib/` (for example `TaskRowHandlers`, now in
     `lib/task-interaction/run-intent.ts`).
3. **`components/` holds only code with two or more consumers**, or the app
   shell that `app/layout.tsx` and `app/(authed)/layout.tsx` mount.
4. **A `lib/` folder groups two or more modules.** A single module is a flat
   file: `lib/invalidate.ts`, `lib/link-metadata.ts`, `lib/note-ticks.ts`.
   The PWA capture intent joined `lib/capture/` as `pwa-intent.ts`.
5. **`components/ui/` does not move.** It is an `optimizePackageImports`
   entry in `next.config.ts`.

Tests are exempt from rule 2: an integration test may call another route's
action to set up its rows.

## Consequences

- Moving a file is the whole fix when a second consumer shows up. Nothing
  else changes.
- `lib/invalidate.test.ts` scans both `app/(authed)` and `lib/actions` for
  actions that run capture.
- ADRs and dated docs that name the old paths stay as written.
