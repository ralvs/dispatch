# A task opens where you are

Date: 2026-10-05

A task's address was `/tasks?edit=<id>`. Every task link outside `/tasks` used
it: Today, a project, a note, a person, Find, a reminder. One click was a full
trip to `/tasks`. The whole board loaded before the form could open. The form
then opened only if the row was drawn in the board's current view, so a quiet
task, a task done more than three days ago, or one outside the filter never
opened. After that, `router.replace("/tasks")` cleaned the address with a
second server render, which could remount the list and close the form that
had just opened. #97 reports both: opening is slow, and sometimes nothing
appears.

## Decision

1. **A task's address is `/tasks/<id>`.** Every task link and every
   notification points there. `/tasks?edit=<id>` redirects to it, for the
   notification rows already stored with the old address.
2. **Inside the app, the form opens over the page you are on.** The authed
   layout has a `@modal` slot. `@modal/(.)tasks/[id]` intercepts the link and
   renders the one task form (ADR-0040) over the current page. Back, Cancel,
   Save and Delete return to that page (`router.back()`).
   `@modal/[...catchAll]` and `@modal/default.tsx` render nothing, so the slot
   is empty at rest and empties when you navigate somewhere else.
   The form is open while the address is the task's own, never by a flag set
   on close: Cache Components keeps a page you leave alive, state and all, so
   a flag set on the way out was still set when you opened the same task
   again. The nav lights the page under the form, not Tasks
   (`usePagePathname`).
3. **Loaded directly, it opens over the Tasks board.** `tasks/[id]` is a
   refresh, an outside link or a notification. It draws the board and the form
   in two Suspense boundaries, so neither waits for the other. Closing goes to
   `/tasks`.
4. **The form has a state for every outcome.** Loading is the form's frame in
   bones. A failed read says "Couldn't open this task." with a retry
   (`error.tsx`, Next's `retry()`). A missing task says it no longer exists.
   Inside the slot this is the dialog's own text, not `notFound()`, which
   would draw the whole not-found page over the one underneath.
5. **The row is read uncached, the options cached.**
   `lib/task-interaction/open-task.ts` reads the task with one query and the
   domains, projects and people through `getCachedTaskFormOptions`. It adds
   the task's own domain and project when the cached lists lack them: a select
   with no option for the stored value submits nothing, and Save would unfile
   the task.
   The row also seeds the entity store (ADR-0069) as a list of one,
   `viewKey.task(id)`, stamped with its read, and the form reads it from
   there. The router replays its older render of the dialog when you open the
   same task again; an edit made in this tab since is newer than that read,
   so it wins, and the form shows what you saved. Nothing is refetched.
6. **On a phone the task form is a full-screen sheet.** `Dialog` takes
   `sheet`: the whole screen below `lg`, the centred dialog over a blurred
   backdrop from `lg` up. `TaskDialog` always passes it, so every task form
   behaves the same. Other dialogs do not change.

Rows on `/tasks` open the same way: the title is the task's own URL, and the
form opens over the board. One way to open a task, everywhere. It costs one
render of the slot, where the old in-place dialog cost none.

## Consequences

- Opening a task from another page costs one server render of the slot, not
  the whole board. The page under it stays, and the edit lands in its row
  through the entity store (ADR-0069).
- A task has a URL that can be shared and reloaded.
- `TaskList` no longer opens a row from the address, and its filter mirror
  leaves the address alone while it is `/tasks/<id>`.
- This amends ADR-0040 Decision 2: the entry points are the header's `+`
  (create) and the task's own URL (edit), which opens on the page you are on.
