---
version: 1
slug: "app-authed-today"
primary_target: "app/(authed)/today"
related_targets: ["app/(authed)/today/today-body.tsx","app/(authed)/layout.tsx"]
---

# Today — surface brief

**Scope:** the `/today` route and the app shell it establishes (header, tabs, page
frame). Sets the visual world the rest of the app inherits.
**Visitor mode:** Operate.

## Audience and job

One operator, already fluent in the tool. Today is a **hub, not a doorway**: he
orients on it in the morning and keeps returning through the day to check
routines off, star tasks, and tick work done. Leaving the page to act is the
failure case. Desktop leads; phone is capture-and-glance.

Realistic load is a working day — 2–5 events, 5–15 open tasks, 5–10 routines, a
couple of alerts. Both the full and the quiet state are common, so neither may
look like a defect.

## Direction

**Pinned by the user**, which overrode the concept roll: `bydefault.so` for type
and palette, `collectiveos.vercel.app` for geometry.

- Type and colour are lifted from bydefault.so exactly — Geist Sans, **weights
  400 and 500 only**, ramp 56/44/36/30/18/16/14/12, `h1` 56px/500/−1.4px/1.04,
  neutral-50 ground, warm stone ink, single orange accent. Hierarchy comes from
  size and colour, never from weight above 500.
- Geometry from collectiveos — pill buttons and tabs, large card radii, soft
  lift.
- **Light is the default theme.** Dark is a complete peer, reached by a single
  `data-theme="dark"` attribute; no forked components. This inverts the
  incumbent, which was dark-first.

Composition was open, and the section inventory changed: *In brief* was cut,
*Projects* added, and the *Resurfaced* quote moved into the left column under
Open.

## Memorable moment

The **day tape**: a proportional 06:00–22:00 measure where committed time is a
filled block in its domain colour, free time is empty, and the now-mark carries
its own hour in black. Events are filled; a scheduled task is an **outlined**
tick in its own domain colour — the shape tells you which is which.

Verified against a real day: at 1092px the tape runs 1.14px per minute, so a
30-minute meeting gets 34px and even a 90-minute lunch gets 102px against the
141px its title needs. **Titles never go inside the blocks.** Start times ride
above the track; titles live in the Timeline list directly below. Evidence:
`.impeccable/mocks/tape-lab.html`.

## The two variants — one axis, switchable

Both are fully designed and rendered. **A2 (rings) is the build.** They differ
on a single coherent axis, *bars vs rings*, and nothing else:

| | A1 — Rail | **A2 — Ring (chosen)** |
|---|---|---|
| Task priority | left rail, height + opacity encode P1/P2/P3 | ring on the checkbox; high adds a halo and steps the title to 500 |
| Routines progress | horizontal bar | completion ring reading `5/8` |
| Project progress | bar under each row | conic ring per row |
| Priority legend | three rail heights | three ring swatches |

Everything else is identical: header, tape, timeline, Top 3, streak trails
(seven tiny squares + run length), quote card, empty states, `Xd late` labels.

Keep the switch cheap at build time: express the difference as one variant flag
plus a shared `Progress` primitive with `bar | ring` renderings, not as forked
sections. Reverting to A1 should be a flag change, never a redesign.

Comps: `.impeccable/mocks/today-a2-ring.html` (chosen, light),
`-dark`, `-quiet`; A1 equivalents alongside.

## Priority colour

One hue at three intensities, not three hues: high is a solid red ring with a
halo, medium the same red at 42% with no halo, low a plain grey ring. The seven
domain colours already sit on the same row as filled dots, so a third hue would
collide with the Travel gold. **Open:** user has not confirmed whether they want
three distinct hues instead.

## States that must ship

- Quiet day — headline falls back to **"You are free."**, both bands show
  placeholders (*Nothing on the clock* / *Nothing open*), tape keeps its ruler
  and now-mark, priority legend hides.
- Past entries dim; the timed task keeps its checkbox.
- Top 3 with an unfilled slot renders the slot, not a gap.

## Unresolved

- Priority palette (one hue vs three) — see above.
- Mobile composition. Everything so far is desktop-first; the dock and the
  single-column stack are not designed yet.
- Whether the tape belongs on other date-driven surfaces or only on Today.
