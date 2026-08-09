# Prose is 65ch; authored headings stay on the closed ramp

Date: 2026-08-09

Gate: `.impeccable/mocks/writing-lab.html` (Pass 3 / W2). Landed in commit
`57495e8`; this ADR records the options that lost and why. Rules already live
in `DESIGN.md` (Prose Measure, Authored prose, Speaker registers, note column +
rail).

## Context

Pass 3 owned the writing surfaces — `/notes/[id]` and `/chat` — after Passes
0–2 settled chrome, tasks, and lists. Three decisions were tangled into one
gate because they trade against the same leftover width: the prose measure,
the type scale for authored headings, and what happens to the rest of the
72rem frame when the column is narrower than the page.

## Decision (W2)

1. **Prose measure is 65ch** (`--measure-prose` / `.measure-prose`). Long-form
   reading and writing — note body, chat message, journal entry, capture
   compose — caps there. Lists are not prose; rows keep the full frame.
2. **Authored prose stays on the closed ramp.** A note's `#` / `##` / `###`
   spend Title (30/500), Lead-at-500 (18), and Section (16/500). No new 24/20
   steps. Body is 16/400 at 1.6. `.prose-authored` is the class.
3. **Note layout is column + rail.** Prose left on the measure; Backlinks and
   Linked take a 260px right rail on desk and stack below on phone. One tree.
   The leftover width of the 72rem frame is the rail, not empty ground.
4. **Chat speaker registers.** User: sans body 400, right-aligned, `ink-2`.
   Assistant: sans body 400, left-aligned, full `ink`, on the measure.
   Distinction is alignment + ink step — never mono-for-person /
   weight-for-machine.
5. **The note editor declines `PageHeader`.** The note's name is editable
   content (Title step in the body). The breadcrumb (`← Notes`) is the
   locator. A page header that repeated the name would fight the field.

## Options that lost

Drawn in `writing-lab.html` as packages over measure + scale + leftover width:

| | Measure | Authored scale | Leftover |
|---|---|---|---|
| **W1** | ~55ch, tighter | closed ramp | empty margins |
| **W2** ← chosen | **65ch** | **closed ramp** | **rail** |
| **W3** | ~72ch / near-full | open 24/20 steps | full-bleed body |

- **W1** read like a book column and left a wide empty band that looked like a
  bug on a tool, not a magazine. The rail was the productive use of that
  width.
- **W3** restored the pre-pass ~150-character lines on the note body and
  invented sizes the closed-ramp rule forbids. Readable for a moment; wrong
  for a system that already rejected "one more step" at the chrome gate.
- **Centred column** (a fourth sketch under W2's measure) deferred: body stays
  16 either way, so a later centred package is a token change and a title
  step, not a new scale.

## Consequences

- `PageSkeleton` still serves route-level loading; the note page's Suspense
  boundaries use content-shaped pulses instead (no header to hold) — recorded
  again in Pass 5 so they are not "the only two never asked."
- Chat and notes share one measure token; capture compose joined it in Pass 4.
- No ADR number was written at land time; this file is the backfill so the
  gate has the same permanent record as 0042–0046.
