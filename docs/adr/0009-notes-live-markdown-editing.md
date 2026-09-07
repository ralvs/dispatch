# Notes are edited in place with live markdown; no explicit Save

> Editing moved from inline list rows (`note-row.tsx`, since removed) to a
> dedicated `/notes/[id]` page — docs/adr/0012. The editing semantics below
> still hold there.

The notes page drops the Edit → textarea → Save/Cancel flow. `note-row.tsx`
mounts a TipTap (`@tiptap/react` + `@tiptap/starter-kit`) editor directly over
the body, always editable — Apple Notes / Mem style. Live markdown input
shortcuts (`# `, `- `, `**bold**`, …) format as you type. `tiptap-markdown`
serializes the doc back to plain markdown text on every change; that string,
not HTML, is what's sent to `updateNoteAction` and stored in `notes.body` —
verbatim, per iron rule #5. The stored representation doesn't change, only
how it's edited.

Saving is autosave: edits are debounced 2000ms (`lib/debounced-save.ts`, a
pure helper covered by its own Vitest suite so the scheduling logic doesn't
need a mounted editor to test), with blur flushing any pending dirty save
immediately as the fallback — so tabbing away or navigating doesn't strand an
edit behind the timer. A save only fires when the markdown actually changed.
The row shows "Saving…" / "Saved" in the meta line; there's no button.
Resolve and Delete stay separate buttons — editing the body never touches
`needs_review`, matching the existing rule that resolving is its own action.

## Why

The owner's habit is Mem/Apple Notes, not form-mode editing. Storing markdown
text (not HTML) keeps the change purely presentational: capture, the
`needs_review` degrade path, and iron rule #5 (bilingual verbatim storage)
are all untouched — they already read/write `notes.body` as plain text.

## Amendment: one allowlisted colour span (2026-09-07)

The stored body is still markdown text. One inline HTML tag is now legal:

`<span data-ink="health">word</span>`

`data-ink` is a palette slug (the nine domain slots, plus `accent` and
`error`) — never a hex. Unknown slugs strip to plain text. `tiptap-markdown`
parses HTML so this span round-trips; the schema only accepts `span[data-ink]`.
Colour is a selection bubble, not a toolbar. Chrome colour meanings (overdue,
error) do not apply inside a note.
