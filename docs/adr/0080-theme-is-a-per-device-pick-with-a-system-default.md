# The theme is a per-device pick with a System default

Date: 2026-10-05

Dispatch had two themes and a toggle between them, and light was the default.
The owner uses it on a desktop and a phone and wants them to differ: the
desktop always dark, the phone following its OS, which goes dark at night. A
light/dark toggle cannot follow the OS, and a default of light ignores it.

## Decision

1. **Three picks: Light, Dark, System.** System follows
   `prefers-color-scheme` and changes live when the OS does, with no reload.
2. **System is the default.** A device with no `theme` cookie, or with a value
   we do not know, follows its OS. A device that already chose `light` or
   `dark` keeps that choice.
3. **The pick is per device, so it stays a cookie.** It does not go into
   `app_settings`, which is one row for the whole app. Each browser has its own
   cookie jar, and an installed iOS PWA has one apart from Safari, so each is
   its own device here. The cookie values are `light`, `dark` and `system`.
4. **<html> carries the pick and its result apart.** `data-theme-pref` is the
   pick; `data-theme` is always `light` or `dark`. The CSS reads only
   `data-theme`, so no token changes. The boot script in `app/layout.tsx` sets
   both before paint, and binds one media listener that re-resolves while the
   pick is System. `lib/theme.ts` holds the same logic for the client; the boot
   script repeats it as a string because it runs before any bundle.
5. **`setTheme` checks the owner.** It was a server action without
   `requireOwnerPage()`, which iron rule #2 requires (docs/adr/0041). It now
   has it, and it rejects a value that is not one of the three picks.

## Consequences

- The `viewport.themeColor` media query now matches the canvas under System.
  A forced pick can still disagree with the browser chrome, as before.
- The web manifest still uses the light ground: it cannot media-query.
- `app/global-error.tsx` still renders light. It replaces the root layout, so
  the boot script does not run there.
