# Every confirmed write says so

Date: 2026-10-28

Sonner toasted failures, capture receipts and task ticks. Every other write
was silent: the row changing on screen was the confirmation. The owner asked
for a toast on every update, in a notch-style island
(https://notch.devsethi.me/, the `notch-toast` package).

## Amends

- ADR-0077: what the writes runner does on a confirm.

## Decision

1. **`notch-toast` replaces Sonner.** One island, attached to the top edge
   (`mode="attached"`, `top-center`), mounted once by `AppToaster`. The
   `lib/client/toast.ts` helpers are still the only callers of the library,
   and the dialog leaves `.nt-root` out of its `inert` sweep.
2. **The island is the page inverted**: ink in light, paper in dark. The
   icon on the left takes a status colour (`--island-*` in `globals.css`),
   from the opposite theme's token because it sits on the opposite ground.
3. **A confirmed write toasts.** `useWrites().save`, `send` and `submit`
   toast `writeSuccessMessage(w)` after the confirm: the builder's own
   `successMessage`, else `successCopy(kind, intent)` (`Task added`,
   `Quote deleted`, `Pinned`, …). `null` confirms silently.
4. **Silent on purpose:** a task tick, skip or reopen (toastTaskToggle
   already toasts on claim) and a note's autosave (the editor shows
   "Saved").
5. **Writes outside the store say so too.** `runAction` takes optional
   success copy; `useResultAction` takes `successMessage` (the settings
   forms); the push toggle and attachment uploads toast directly.

## Consequences

- One toast shows at a time: a newer toast replaces the one on screen. A
  failure toasted after a success wins, and the reverse is true too. The
  attachment upload skips its success toast when a file was refused, so the
  refusal stays up.
- notch-toast has no description line. A description rides on the title
  after a dot; long titles end in an ellipsis.
- A new write gets a toast with no work. To change its copy, pass
  `successMessage` to `write()`.
