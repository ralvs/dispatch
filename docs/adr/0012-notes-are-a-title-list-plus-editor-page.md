# Notes are a title index; each note is edited on its own page

`/notes` no longer renders every body inline. It is a Mem/Apple Notes-style
index: title rows (falling back to the first body line, then "Untitled"),
newest first, with the `needs_review` section kept on top as the capture
safety net's queue. Clicking a row opens `/notes/[id]` — a full-page editor
with the title as a borderless input above a TipTap body.

All of docs/adr/0009's editing semantics carry over unchanged to the page:
live markdown input shortcuts, `tiptap-markdown` serializing back to plain
markdown text stored verbatim (iron rule #5), autosave debounced 2000ms via
`lib/debounced-save.ts`, blur/unmount flushing pending edits, and a
"Saving… / Saved" meta line instead of a Save button. Title edits share the
same debounced save as the body. Resolve and Delete stay explicit buttons;
Delete returns to the index.

Creation is Apple Notes-style: "+ New note" inserts a blank row server-side
and redirects to its editor, so autosave always has a real id to write
against. Consequently an empty body is now a legal stored state — the old
"blank body always rejects" rule died with the create/edit form it guarded.
Capture-created notes are unaffected; they always arrive with content.

## Why

The old page mounted one always-editable TipTap instance per note, which
doesn't scale past a handful of notes and buries any single note in a wall
of editors. The owner's habit (Mem, Apple Notes) is list-then-open. Storage
shape is untouched — this changes where editing happens, not what is stored.
