# Domains are a Library page; More is a menu

Date: 2026-08-09

Supersedes the **domain half** of
[ADR-0011](./0011-health-books-cut-domains-live-in-settings.md).
Amends [ADR-0014](./0014-ops-shell-day-schedule-link-ingest.md)'s claim that
More hosts Library + System as a **page**.

## Context

ADR-0011 folded `/domains` into `/settings` because domains were configuration,
not a daily destination, and every primary destination needed a tab under a
five-tab shell (Today / Notes / Projects / People / Settings). That trade was
correct for its shell.

ADR-0014 replaced that shell: tabs are Today / Tasks / Notes / Links / More,
and everything else is reached under More. A route costs one line in
`nav-links.ts` and no tab at all. The pressure that justified the merge
expired with the IA change underneath it.

Domains are also not only knobs any more. A domain carries a stored palette
slug (DESIGN.md, Stored Slug Rule), a cadence threshold, and a last-shipped
date, and it is what `/tasks`, `/projects` and the day tape colour themselves
by. That is reference material the app keeps records of — the same kind of
thing as Projects and People — not a settings section.

Separately, once domains leave `/settings`, what remains is four controls plus
account chrome. `/more` was a destination list plus the account footer — a menu
wearing a page's clothes. Pass 4 closed that on the decision surface
`.impeccable/mocks/config-lab.html`.

## Decision

1. **`/domains` is a Library page.** Object list under ADR-0044: `PageHeader`
   with measure, `+ New domain` in the action slot opening a dialog, `SectionHead`
   for Active / Archived, rows on `ListRow` with names at 400 and the domain
   dot leading. Lives in `LIBRARY` next to Projects and People, not in
   `SYSTEM`.
2. **`/settings` is configuration only.** Notifications, app (timezone,
   reminders), and **account** (theme, email, sign out). Options grow here.
3. **More is a menu, not a page.** Destinations only (Daily / Library /
   System). Desk: popover under the tab group (B1). Phone: sheet above the
   dock. No `/more` route content — bookmarks redirect to `/today`.
4. **A1 active mark.** More stays lit for every destination the menu hosts,
   even while the menu is closed, so the dock/header still answers "where am
   I?" on Projects, Domains, Settings, etc.

## Why the original merge no longer holds

ADR-0011 optimised against a constraint that is gone: every destination had to
be a tab or be unreachable on a phone. Under ADR-0014's More-hosted model the
trade does not exist. This is not "the old decision was wrong" — it is "the
constraint it optimised against expired."

## Consequences

- Domain deep links move from `/settings#domain-…` to `/domains#domain-…`.
- Account chrome leaves the More surface for Settings.
- ADR-0014's "More hosts Library + System" is still true of the **menu's
  inventory**; it is no longer true of a route.
- Capture palette is unrelated to this ADR; it was brought onto `Dialog` /
  `Button` / `Textarea` in the same pass for system consistency only.
