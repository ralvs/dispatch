# People are mentioned with `@`, and mentions get their own table

Date: 2026-07-27

## Context

`people`, `person_facts`, and `person_interactions` have existed since the
original schema, with full CRUD and a `/people` directory. Nothing ever linked
them to content. The single exception is `notes.related_person_id`, a column no
select reads and no code writes — it has been dead since the day it was
created.

So the person graph was a directory, not a graph: you could record that someone
exists, but never that a task or a note was about them.

Two precedents in the repo pull in different directions. ADR-0019 established
"the parser emits **names**, the server resolves ids", and
`lib/services/capture/resolve.ts` does exact, case- and diacritic-insensitive
name matching for domains and projects. But note-to-note wikilinks went the
other way: `lib/wikilinks.ts` stores `[[uuid|label]]` in the markdown and syncs
the extracted uuids into `note_links`, so a note rename never rewrites other
notes' bodies.

Both are right for their surface, which is the crux of this ADR.

## Decision 1 — a new `mentions` table, not an extension of `note_links`

`note_links.note_id` is `NOT NULL`, and its table-level CHECK and unique index
are built around a note being the source. Adding a `'person'` target type would
have covered note→person and left task→person homeless — forcing either a
second table anyway, or a nullable `note_id` that guts the invariant the CHECK
exists to hold.

`mentions` is polymorphic on the **source** side instead, borrowing
`note_links`' one-column-per-type CHECK idiom. It carries `matched_name`, the
verbatim text that resolved, so a later rename can be repaired rather than
guessed at.

`notes.related_person_id` stays dead and untouched. Removing it is a separate
cleanup with its own migration.

## Decision 2 — structured in notes, plain in tasks

The syntax differs per surface, deliberately:

| | notes | task title / notes |
|---|---|---|
| stored | `@[uuid\|Name]` | `@Name` |
| resolved | by uuid, at parse | by name, at save |
| survives a rename | yes | link yes, visible text no |

Notes are TipTap, so the uuid is never visible while editing and the wikilink
precedent already applies. Task titles are a plain `<input>`, where a raw uuid
sitting in the visible text of "Call @[3f2a…|Ana]" is not acceptable — so tasks
follow ADR-0019 and resolve by name.

The cost is honest and was accepted explicitly: two parse paths in
`lib/mentions.ts`, and text copied out of a note into a task title carries a
visible uuid. The alternative — plain `@Name` everywhere — was the
recommendation from design review, and was rejected in favour of notes
surviving a person rename.

## Decision 3 — the plain-text parser matches longest-first, and never guesses

`@Renan Alves` cannot be found by a regex, because nothing in the text says
where the name ends. So the task-side parser works against an index built from
the people list: from the `@`, take up to *N* tokens (*N* = the longest known
name), then try the joins **longest first**, stripping trailing punctuation.

Two guards matter more than the algorithm. An `@` preceded by a word character
or `.` is not a mention — that is what makes `renan@alves.id` an email address
rather than a mention of a person named `alves`. And a normalized name matching
two or more people resolves to **nothing**: ambiguity is dropped, never
guessed, matching ADR-0016's posture on ambiguous entity matches.

The parser is pure and client-safe — no `server-only` import — because the
task-side autocomplete needs it in the browser, exactly as `lib/wikilinks.ts`
is shared between the editor and the save action.

## Decision 4 — sync is a full reconcile, and it never fails a capture

`syncMentions` mirrors `syncWikilinks`: validate, delete stale, insert missing,
swallow the duplicate-key error. Because it reconciles rather than appends, any
re-save self-heals a stale link.

It runs on task create, task update, note autosave, quick-add, and the capture
executor's task branch. The capture call site is wrapped in `try`/`catch`: a
mention that fails to resolve, or a sync that errors, must never fail a capture
(iron rule 4). A missed mention is a missing link; a thrown capture is lost
input.

## Consequences

- `/people/[id]` gains a "Mentioned in" panel — the payoff, and the reason the
  join table is worth more than a `text[]` column would have been.
- Renaming a person keeps every link intact in both surfaces, because the
  `mentions` rows are materialized. Only the *visible text* of task titles goes
  stale, and `matched_name` records what it used to say.
- A person can be mentioned once per source; the partial unique indexes make
  duplicates unrepresentable rather than merely unlikely.
- Deleting a person cascades their mentions away. The task and note text keeps
  the `@Name` string, which is correct — the content is stored verbatim
  (iron rule 5) and is not ours to rewrite.
- People are still **out** of the capture vocabulary. The AI parser continues to
  emit `needs_review` for an utterance naming a person it cannot route
  (ADR-0008/0016); mentions are extracted from the resulting text, not from the
  parse. Bringing people into the vocabulary is a separate decision.
