# One capture line on /tasks

Date: 2026-07-24

## Context

ADR-0019 D3 added an NL quick-add input to `/tasks` alongside the existing
`+ New task` collapsible form. Both shipped, and both stayed: opening the form
put a second text field ("What needs doing?", set at display scale inside a
rounded card) directly beneath the quick-add field. Two inputs for one job,
eight pixels apart, with no way to tell which one was the real one.

The card had collected other debt too. Native `<input type="date">` and
`<input type="time">` painted the browser's `mm/dd/yyyy` / `--:-- --` skeleton
at full ink weight, so an untouched field read exactly like an answered one.
Five controls sat at four widths and two heights. The priority segment
pre-selected P4 as a solid grey fill, which reads as *disabled*, not as
*chosen*.

## Decision 1 — one field, two depths

> **Superseded by ADR-0043.** The capture line is gone; `/tasks` writes tasks
> through a single `+ New task` in the page header, and the parser moved into
> the dialog behind one rule (title-only parses, anything else is literal).
> Decisions 2, 3 and 4 below are untouched — the relative chips, the `data-empty`
> date styling and the priority marking all live in `TaskMetaFields` and
> `PriorityPicker`, which the dialog still composes. The first risk accepted
> below is resolved rather than inherited: the two depths are now one form with
> a stated, visible rule.

The quick-add line is the only place a task gets written on `/tasks`
(`app/(authed)/tasks/capture-bar.tsx`). It has two depths, not two fields:

- **Closed** — type a sentence, press Enter, the text goes to
  `quickAddTaskAction` and the parser reads it. Unchanged from ADR-0019 D3.
- **Open** (`Details`) — the meta row expands *beneath the same field*. The
  text already typed becomes `title` verbatim and `createTaskAction` takes it
  with the meta. No parsing: opening Details means "I'll say it myself".

A second title input never renders. `TaskFormFields` (title + notes + meta)
survives for the row-level edit form, which does need all three; the create
path composes `TaskMetaFields` on its own.

The collapsible card is gone from this route — the details sit on the page
ground under a hairline, not in a rounded surface panel. `CollapsibleForm`
itself is untouched and still serves people/quotes/routines/notes/projects.

## Decision 2 — relative chips are the fast path for a due date

`Today` / `Tomorrow` / `+1 week` write the date field directly, computed with
`shiftDay()` from a server-supplied `todayIso` — never `new Date()` in the
browser, which would resolve in the visitor's zone rather than the app's
(iron rule #1). Clicking the active chip clears the date.

The native date input stays as the exact path: it is keyboard- and
mobile-native, and a hand-rolled picker is a large surface to own for a field
that is usually one of three days out. Its format still follows the browser
locale (`mm/dd/yyyy` on a US-locale browser) — the chips are what make that
tolerable, and a custom picker is the remedy if it stops being.

## Decision 3 — emptiness is tracked in React, styled in CSS

CSS has no "this date input has no value" selector, so `TaskMetaFields` holds
the date and time in state and exposes `data-empty` to a stylesheet that drops
`::-webkit-datetime-edit`'s sub-fields to `--ink-4` and dims the picker glyph.
An untouched field then reads like every other placeholder in the app. The
colour must be set on each sub-field pseudo-element (`-day-field`,
`-month-field`, …); setting it on the container alone does not cascade.

## Decision 4 — priority marks the answer, not the scale

Only the selected priority carries colour, shown as a 2px inset rule in that
colour rather than a filled cell. Four always-coloured cells shout before an
answer exists, and a filled grey P4 — the default for every new task — reads
as a disabled control.

## Risks accepted

- **The two depths file differently.** Same text, Enter versus Add task, can
  produce different rows: the parser may extract a due date and recurrence
  from the sentence, while Details takes the sentence literally and uses the
  fields. This is the intent (explicit beats inferred once you have opened the
  fields), but it is not visible in the UI.
- **Locale-formatted dates remain.** A browser set to `en-US` still shows
  `mm/dd/yyyy` and a 12-hour clock in an app whose zone is America/Sao_Paulo.
- **No test covers the branch.** `CaptureBar`'s choice between
  `onQuickAdd` and `onCreate` is component state; the services under both
  paths are already covered, the wiring between them is not.
