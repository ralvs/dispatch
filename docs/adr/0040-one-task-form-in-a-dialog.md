# One task form, in a dialog

Date: 2026-08-05

## Context

A task could be written on two surfaces that were built separately and drifted
apart. The capture bar's `Details` (ADR-0020 D1) expanded a meta row beneath
the quick-add field: no notes field, no delete, footer reading
`Cancel · Add task`. A row's edit form replaced the row in place with a second
hand-rolled `<form>`: title, notes, meta, and a `Delete · Cancel · Save`
footer, plus its own Escape/Enter key handling.

Same fields, two layouts, two keyboard contracts, two footers — and every fix
had to be made twice. The inline edit form also had a structural cost: the row
it replaced disappeared while editing, so the list reflowed under the cursor
and the task being edited lost the context of the rows around it.

## Decision 1 — `Dialog` is the app's modal shell

`components/ui/dialog.tsx` owns the whole modal contract once: portal to
`document.body`, focus moved in on open (`[data-autofocus]` first) and
restored to the trigger on close, a Tab focus trap, Escape and backdrop
dismissal, background scroll lock, and `inert` on every body child behind it
except live regions — so a toast raised while the dialog is open stays
reachable. `DialogBody` scrolls; `DialogFooter` is pinned.

Children mount only while open. Every consumer seeds its fields from props, so
unmounting is what makes reopening show current values rather than the last
edit.

`CapturePalette` keeps its own copy of this choreography for now: its state
machine, receipt view and dock-portalled trigger are woven through it, and
folding it in is a separate change.

## Decision 2 — `TaskDialog` is the only task form

> **Amended by ADR-0043**, which strengthens this rather than replacing it. The
> capture bar is gone, so its `Details` is no longer an entry point and the
> dialog is the *only* place a task is written on `/tasks` — reached from the
> header's `+`, a row's title, or `?edit=`. The natural-language parser moved
> into this form behind one rule: a create carrying nothing but a title parses,
> anything else is literal. The keyboard contract below is unchanged.

`app/(authed)/tasks/task-dialog.tsx` renders `TaskFormFields` (title, notes,
meta) for both modes. Create and edit differ in three strings and two
optional props — `onCreate` (the list's optimistic wrapper), `taskId` and
`onDelete` — not in layout. Every entry point opens it: the capture bar's
`Details`, a row's title, and the `?edit=` deep link from Today.

Consequences of one form rather than two:

- **Notes are now on the create path.** They were edit-only because the
  inline create had nowhere to put them, not because a new task never has one.
- **The row stays visible behind the dialog.** `?edit=` scrolls the row into
  view rather than the form, since the form is no longer where the row was.
- **One keyboard contract.** Enter submits from single-line fields; the notes
  textarea keeps newlines; buttons and selects keep Enter for themselves;
  Escape closes (the mention dropdown consumes both first when it is open).

ADR-0020 D1 still holds where it matters — the capture line is the only place
a task is *written* on `/tasks`, and a second title field never renders beside
the first. What changed is where `Details` puts the rest of the fields.

## Decision 3 — the meta row fills the surface, Reset holds a fixed seat

The fields inherited fixed widths from a form that lived in a list row
(`w-[11rem]` selects, a priority segment sized to its four labels). In a
dialog that left a column of dead space at the end of the row. Domain,
Repeats and Priority are now a three-column grid that spans the surface and
stacks on narrow screens; the priority segment stretches so its cells share
the grid's rhythm. Due date and time absorb the width the relative chips
don't need.

Reset moved out of the chip row and onto the group's label line as an icon.
It used to be `opacity-0` until a date existed, so the chips beside it shifted
the moment one was set. It is now always in place and merely disabled, and it
hovers red (`--error`) rather than blue: it is the one control in the group
that takes an answer away rather than giving one.

Label-to-control spacing went to `space-y-7`. At the previous gap each label
sat nearer the control above it than the one it named, so it read as a
caption on the wrong field.

## Risks accepted

- **A modal for a two-field edit.** Changing one task's priority now costs an
  overlay. The trade is that it is the same overlay every time, and the list
  no longer reflows mid-edit.
- **Create and edit still file differently.** `createTaskAction` maps an empty
  domain to `null` (unfiled) where `updateTaskAction` maps it to `undefined`
  (leave alone), per ADR-0027. One form, two write mappings.
- **Still no test over the branch.** `CaptureBar`'s Enter-versus-Details
  choice and `TaskDialog`'s mode split are component state; the services under
  them are covered, the wiring is not.
