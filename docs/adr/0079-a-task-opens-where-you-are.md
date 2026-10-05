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
6. **On a phone the task form is a full-screen sheet.** `Dialog` takes
   `sheet`: the whole screen below `lg`, the centred dialog over a blurred
   backdrop from `lg` up. `TaskDialog` always passes it, so every task form
   behaves the same. Other dialogs do not change.

Rows on `/tasks` keep their in-place dialog. They already hold the row and the
options, so they open with no request.

## Consequences

- Opening a task from another page costs one server render of the slot, not
  the whole board. The page under it stays, and the edit lands in its row
  through the entity store (ADR-0069).
- A task has a URL that can be shared and reloaded.
- `TaskList` no longer opens a row from the address, and its filter mirror
  leaves the address alone while it is `/tasks/<id>`.
- This amends ADR-0040 Decision 2: the entry points are the header's `+`, a
  row's title on `/tasks`, and the task's own URL, which opens on the page you
  are on.
