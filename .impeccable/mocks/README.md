# Today comps

Design comps for the Today refactor. Throwaway HTML, not app code — the shared
world lives in `_a.css`, and each `*.standalone.html` inlines it so the file
opens anywhere.

Serve them with `bun run` — or the `mocks` entry in `.claude/launch.json`
(`python3 -m http.server 4500 --directory .impeccable/mocks`).

## The build

**A2 — Ring**, light theme. `today-a2-ring.html`

## Files

| File | What it shows |
|---|---|
| `today-a2-ring.html` | **The build.** Light, a full working day. |
| `today-a2-ring-dark.html` | Same, `data-theme="dark"`. |
| `today-a2-ring-quiet.html` | Empty-day states. |
| `today-a1-rail.html` | The alternate. Light. |
| `today-a1-rail-dark.html` | Alternate, dark. |
| `today-a1-rail-quiet.html` | Alternate, empty states. |
| `tape-lab.html` | Why the day tape carries no event titles — measured against a real day. |

## A1 vs A2 — one axis

The two differ only in how **progress and priority** are drawn. Everything
else — header, day tape, timeline, Top 3, streak trails, quote card, empty
states, late labels — is identical.

| | A1 — Rail | A2 — Ring |
|---|---|---|
| Task priority | left rail; height + opacity encode P1/P2/P3 | ring on the checkbox; high adds a halo, title steps to 500 |
| Routines progress | horizontal bar | completion ring (`5/8`) |
| Project progress | bar per row | conic ring per row |
| Legend | three rail heights | three ring swatches |

When this is built, keep the difference as **one variant flag over a shared
`Progress` primitive** with `bar | ring` renderings. Switching back to A1 should
be a flag, never a redesign.

## Themes

Light is the default. Dark is the same tokens under
`[data-theme="dark"]` in `_a.css` — no forked components, no separate stylesheet.
