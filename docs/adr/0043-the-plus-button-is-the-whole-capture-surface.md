# The plus button is the whole capture surface on /tasks

Date: 2026-08-08

Supersedes ADR-0020 D1 (the standing capture line). ADR-0040 still holds
unchanged: there is one task form and it lives in a dialog.

## Context

`/tasks` carried three ways to write a task, and the reader was expected to
know which one they wanted before they started typing.

1. The shell's **Capture** pill, which accepts anything — a task, a note, a
   link, a thought — and runs the full capture pipeline to work out which.
2. The page's own **capture line**, a standing field above the list whose Enter
   ran the natural-language task parser directly.
3. That line's **Details** button, which opened the task dialog with whatever
   was typed as the title, verbatim.

The second exists for a reason that is real but is not the reader's: it
short-circuits the capture pipeline's classification step, because on this page
the answer is already known to be "a task". That is a cost argument about AI
calls, and it had been promoted into a piece of standing furniture at the top of
the app's second-busiest surface.

The owner's framing: capture already does this, and the page-level line is a
shortcut to use less AI. That makes it an implementation detail wearing the
clothes of a feature.

## Decision 1 — one action, and it sits on the title's shoulder

The capture line is deleted. `/tasks` takes a single **unlabelled `+`** set
immediately beside the page's name: 32px, fully round, transparent on a
`line-strong` hairline, an `ink-3` glyph. It opens the task dialog.

It was first built as a labelled `+ New task` in the header's right-hand action
slot, matching `/notes`. That was wrong here for a reason `/notes` does not
have: the shell's **Capture** pill sits in the same corner region, and a second
labelled create action a few pixels below it reads as a second Capture — which
is precisely the confusion this decision exists to remove. Moving it to the
title and dropping the word removes the competition. Shape carries the meaning
instead of a label, and that is only legible because the page is named twelve
pixels to its left.

The voice still matters. The pill is reserved for the shell's two standing
actions (DESIGN.md, Buttons), and this is not one — it is round because
DESIGN.md makes anything a thumb reaches for a full pill, and it carries no
sans label to make it the pill *voice*. The word survives in `aria-label`, so
the control is named for anyone who cannot see the glyph.

`PageHeader` grows a `titleAction` slot for it — an action belonging to the name
rather than to the right edge. The h1 keeps its own first-line baseline inside
the new wrapper, so the measure and the right-hand action still align as before
and `/notes` is untouched.

It also settles a complaint the Pass 1 comps raised against the chosen header:
with no measure and no action, `/tasks` opened with 36px of name over an empty
baseline. It now carries exactly one control, and it is the one the page is for.

## Decision 2 — the parser moves into the dialog, behind one rule

The natural-language path is not lost, it is relocated. In create mode:

> **A create carrying nothing but a title goes through the parser. A create that
> has touched any other field is taken literally.**

"Nothing but a title" means every other field is still in the state the form
opened in — no date, no time, no notes, Unfiled, Never, P4. The check reads off
the submitted `FormData` rather than tracked state, because the fields are
uncontrolled by design and remount on every open, so the payload is the only
thing that cannot drift from what is on screen.

The rule holds for **Enter and for the footer's primary equally**, so the two
can never disagree — which is the whole reason it is one rule and not two paths.
ADR-0040's keyboard contract is unchanged: Enter still submits from single-line
fields, the notes textarea still keeps newlines, Escape still closes.

Taken-literally is the conservative half on purpose. If a due date has been set
by hand, parsing the title could only overrule it, and being overruled by a
sentence you also typed is worse than a stray "tomorrow" left in a title.

The rule is invisible from the field alone, so the dialog announces it: the
create placeholder carries an example (`"pay rent every monday 9am"`) and one
quiet mono line sits under the title. Both render only where `onQuickAdd` is
actually wired up — the row-level dialogs are edit-mode and show neither.

## Consequences

- **`capture-bar.tsx` is deleted.** Its Enter-versus-Details branch, the one
  piece of this page ADR-0040 recorded as untested, goes with it.
- **The two-title-fields problem dissolves.** ADR-0020 D1 and ADR-0040 both had
  to state that a second title field must never render beside the first. There
  is now one title field on the page.
- **ADR-0020's first accepted risk is resolved, not inherited.** It recorded
  that the two depths could file the same text differently and that the
  difference "is not visible in the UI". One form with one stated rule, and a
  line under the title that states it, is what closes that.
- **Writing a task costs a click it did not.** The line was always there; the
  dialog has to be opened. Accepted: the shell's Capture is still one click from
  anywhere and still accepts a task, so the cheap path did not disappear from
  the product — it disappeared from this page, where it was the third of three.
- **Capture still degrades to `needs_review` rather than dropping input** (iron
  rule #4). Nothing in this decision touches the capture pipeline; it removes a
  bypass around it.
- **Still no test over the branch.** The title-only check is component state at
  the FormData boundary. `quickAddTaskAction` and `createTaskAction` are both
  covered underneath it; the choice between them is not.
