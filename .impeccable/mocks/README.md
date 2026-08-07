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
| `today-a2-ring-mobile.html` | **The build, on a phone.** Same day at 393pt. |
| `today-a2-ring-mobile-dark.html` | Same, `data-theme="dark"`. |
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

## Phone

`_m.css` layers on `_a.css` and carries only what 393pt forces to change. Open a
mobile comp on a desktop browser and it renders inside a 393×852 device with
emulated safe-area insets; open it on a phone (≤460px) and the frame drops away
and it goes edge to edge. Same markup, two presentations.

Four things change, and nothing else does:

1. **`h1` steps 56 → 36** on the pinned ramp. It still breaks on the em-dash.
2. **The day tape becomes a glance strip.** At 0.37px per minute the per-block
   start times above the track would overlap two-deep, so they go; the ruler
   keeps `06:00 · now · 18:00 · 22:00` and the now-mark keeps its own hour. The
   percentages are the desktop arithmetic untouched. Every time and title is in
   the Timeline directly below — which was already the tape's contract.
3. **Two columns become one**, ordered orientation-first: headline → tape →
   Top 3 → Timeline → Open → Routines → Projects → Resurfaced. Top 3 and
   Routines sit above the long lists because the phone is where they get ticked.
4. **Tabs leave the header for the dock**, and capture becomes the dock's
   action. The date moves into the app bar, so it stays visible after the
   headline scrolls away.

At build time this is **one responsive tree, not a fork**: every rule in
`_m.css` belongs under a max-width query beside its desktop peer, and the stack
order is `display: contents` + `order` over the same sections. `_m.css` is a
separate file here only so the locked desktop comps stay byte-identical.

Touch: rows are ≥48px and every checkbox carries a 44px hit slug via
`.check::before`, which the desktop comps do not need.

