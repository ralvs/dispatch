# Build brief — Today, revision A

Paste the block below into a fresh Claude Code session at the repo root, on
branch `design/impeccable`. Everything it needs is on disk; it should not need
this file's prose.

---

## The prompt

> Build the Today refactor on branch `design/impeccable`. This is a **complete
> visual refactor**, not a polish pass — the incumbent look is evidence of what
> exists, never authority over what replaces it.
>
> **Read first, in this order:**
> 1. `.impeccable/surfaces/app-authed-today.md` — the surface brief. It is the
>    spec. Every decision in it is settled unless it sits under "Unresolved".
> 2. `.impeccable/mocks/README.md` — how the comps are organised and what the
>    phone composition changes.
> 3. `.impeccable/mocks/today-a2-ring.html` (desktop, the build),
>    `-dark`, `-quiet`, and `today-a2-ring-mobile.html`, `-dark`, `-quiet`,
>    `-otherday`. `_a.css` is the shared world; `_m.css` is the phone layer.
>    Serve them with the `mocks` entry in `.claude/launch.json` (port 4500).
> 4. `docs/adr/0041-the-iron-rules.md` and `CONTEXT.md` — the invariants and the
>    glossary. Terminology is load-bearing; do not vary words for readability.
>
> **`DESIGN.md` describes the OLD world** — dark-first, Geist 600, Signal Blue.
> It is the anti-reference for this work, not the target. Do not follow it, and
> do not update it as you go; regenerate it with `/impeccable document` once the
> build settles.
>
> **Phases. Commit at the end of each one; do not bundle them.**
>
> 1. **Tokens and the theme flip.** Port `_a.css`'s world into
>    `app/globals.css`: neutral-50 ground, warm stone ink ladder, single orange
>    accent, the seven domain colours, `--r-card: 22px` / `--r-md: 12px` / pill,
>    the soft lift, Geist Sans at **weights 400 and 500 only** with the
>    56/44/36/30/18/16/14/12 ramp. **Light becomes the default and dark becomes
>    the `data-theme="dark"` peer** — this inverts the incumbent, so the boot
>    script and the theme toggle both flip with it. Highest blast radius in the
>    whole build: all 13 other surfaces inherit these tokens and will shift.
>    Screenshot `/tasks`, `/inbox`, `/notes` and `/projects` before and after and
>    fix what actually breaks; do not redesign them in this phase.
> 1b. **The domain palette becomes a token, not a hex.** Port the nine domain
>    colours from `_a.css` (evidence: `.impeccable/mocks/palette-lab.html`) and
>    change how a domain's colour is *stored*:
>    - `stewardship_domains.color` goes from a hex string to a **palette slug**
>      (`engine`, `health`, `family`, `spirit`, `finance`, `code`, `travel`,
>      `pine`, `burgundy`). A stored hex cannot theme-switch, and dark is a full
>      peer now.
>    - Migration: map the seven seeded domains to their assigned slugs by name,
>      and any other value to null. There are only eight rows plus Inbox; do not
>      build a colour-distance mapper for this.
>    - `HexColorSchema` in `lib/schemas/color.ts` becomes a slug union, and
>      `COLOR_PALETTE` — currently eight hexes "picked to read well on the warm
>      linen background", an identity that was replaced twice — is deleted.
>    - `components/color-dot.tsx` and `components/color-swatch-picker.tsx` render
>      `var(--domain-<slug>)` instead of an inline hex. Keep the picker's "None"
>      option and its `null`-clearing behaviour, which `lib/form-decode.ts`
>      depends on.
>    - **Do not retune the colours by hand.** They meet three measured floors in
>      both themes; change them in the lab and re-measure, or not at all.
>
> 2. **The shell.** Desktop header (brand, pill tabs, Ask + Capture) and the
>    mobile dock — restyle `components/bottom-tab-bar.tsx` to the comp: active
>    tab on `accent-soft` with accent ink, capture as a round ink capsule with a
>    Lucide `Plus`. The IA does not change: Today / Tasks / Notes / Links / More,
>    from `components/nav-links.ts`. Keep the safe-area handling and the
>    "shell owns the viewport" rule exactly as they are (ADR-0028).
> 3. **A shared `Progress` primitive** with `bar | ring` renderings, plus one
>    variant flag. A2 (ring) is what ships; reverting to A1 must be a flag
>    change, never a redesign.
> 4. **The Today page itself**, top down: day nav as the dateline → headline →
>    counters → all-day band → day tape → Top 3 → Timeline → Open → Routines →
>    Projects → Resurfaced. `app/(authed)/today/`.
> 5. **Fallout sweep** across the other routes, then regenerate `DESIGN.md`.
>
> **Constraints that outrank the comps:**
> - The six iron rules (ADR-0041), cited by number at ~70 call sites.
>   `requireOwner()` first line of every action; all calendar logic through
>   `lib/dates.ts`; UI chrome in English while user content stays verbatim.
> - **Mobile is a responsive layer, not a fork.** One component tree: every
>   `_m.css` rule becomes a max-width query beside its desktop peer, and the
>   stack reorder is `display: contents` + `order` over the same sections. If
>   you find yourself writing a `<MobileToday>`, stop.
> - The day nav keeps its current client-owned behaviour (`day-view.tsx`): a
>   chevron reloads only the schedule payload, never the Today RSC or
>   `loading.tsx`, and `?d=` stays in the URL. Only the chrome changes.
> - **Do not "fix" the `--ink-3` / `--ink-4` contrast.** It misses WCAG AA and
>   that is a recorded decision for fidelity to the pinned palette. The brief
>   says so under "Decided, with the tradeoff on the record".
> - Compose `components/ui/` primitives; no raw hex in app code; Lucide only;
>   honour `prefers-reduced-motion`.
> - Biome lint, Biome format and `tsc --noEmit` clean before every commit.
>   Conventional commits.
>
> **Verify in the browser, not by assertion.** Use the `dispatch` entry in
> `.claude/launch.json`, and check both themes and both widths per phase.
>
> Do not merge to `main`. The branch is merged in one go when the whole refactor
> is done.

---

## Why the phase order

Phase 1 is the only irreversible-feeling step, because the token flip touches
every surface at once and the app is dark-first today. Doing it first means the
rest of the build is drawn on the real ground rather than against it — and any
fallout on the other 13 surfaces surfaces immediately, while the diff is still
small enough to read.

Phases 2 and 3 exist so phase 4 has nothing left to invent: by the time the
Today page is assembled, the shell and the one genuinely new primitive are
already standing and tested.
