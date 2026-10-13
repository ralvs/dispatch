# One form decode per entity

Date: 2026-10-13

A form write has two halves (docs/adr/0077): the optimistic intent the store
applies at once, and the server action that writes the row. Each half read
the FormData its own way. The server ran `decodeForm` against the entity's
schema; the writes module hand-rolled a second reading with its own regexes,
trims and defaults. The two disagreed at the edges: a project's `target_date:
"soon"` showed as `null` on the page while the server refused it, the quote
and journal actions each kept a private `tagsFromForm`, and the default task
priority was the literal `3` in five places. A project edit also decoded
outside `runFormAction`, so a bad field threw instead of coming back as a
field error.

Amends ADR-0077 item 6: the end state is a shared decode, not a typed wire
payload.

## Decision

The server half keeps the FormData. Each form has one decoder, built with
`formDecoder` from `lib/form-decode.ts` and kept beside its schema in
`lib/schemas/<entity>.ts`. The server parses with it inside `runFormAction`,
where it is the authority and a refused field becomes a field error. The
writes module reads the same FormData with the same decoder and builds the
optimistic row or patch from the typed input. A form the decoder refuses gets
an intent that shows nothing, so only the server's answer moves the view.

1. **`formDecoder(schema, { spec?, overrides? })`** returns `parse` (server;
   throws `ZodError`) and `read` (client; never throws, `null` on a refused
   form or a throwing refine). Fixed overrides merge first, per-call
   overrides last. The absent-versus-blank rule stays in `lib/form-decode.ts`.
2. **A comma-separated list is a `"list"` field kind**: absent is omitted,
   present is split on `,`, trimmed, and empties dropped, so blank is `[]`.
3. **Optimistic builders take the typed input, not FormData.**
4. **The intent that shows nothing**: a record create or patch becomes
   `unshown(id?)` (`lib/store/kinds/record.ts`), a patch no row holds; a task
   create becomes `{ type: "edit", id }` on a fresh id. Neither moves a view
   or a counter, and a confirm with the server's row still lands it.
5. **`DEFAULT_TASK_PRIORITY`** in `lib/schemas/task.ts` is the one default
   priority.

## Consequences

- Quotes, journal entries, tasks, projects, domains, people and routines
  decode each form once.
- What the page shows while a write is in flight is what the server will
  write, or nothing.
- A refused project edit returns its field errors instead of throwing.
- A task create the client refuses but the server accepts would land without
  moving a counter until the next read. Both halves run the same decoder, so
  this should not happen.

## Deferred

- **Notes** followed: the editor autosave decodes through `SaveNoteSchema`
  (`lib/schemas/note.ts`) on both halves; a blank title is null there.

Domains, people and routines followed in a second pass: the domain edit
form's schema now owns the cadence field, and the domain edit and person
interaction actions decode inside `runFormAction`.
