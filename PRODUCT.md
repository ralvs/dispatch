# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One primary user: Renan, the owner-operator, running his own life and work out
of a single instrument. He is a power user of his own tool — he knows every
affordance, every route, and every keyword the parser accepts, and he never
needs to be taught the product.

Two distinct situations, and they are not equally weighted:

- **At a keyboard (the design-leading scene).** Reviewing tasks, writing and
  editing notes, planning the day, filing the inbox, working through projects
  and people. When phone and desktop pull in different directions, desktop
  wins.
- **Away from the keyboard.** Capture only — dictating into an Apple Watch,
  sharing a URL or a selection from the iOS share sheet, typing one line into
  the installed PWA. This scene is about getting a thought out of his head
  before it evaporates, not about reading or organizing.

Multi-user is not built and not planned, but it is not ruled out either. Design
should avoid decisions that would be expensive to unwind — identity hardcoded
into visible copy, or an information architecture that only makes sense for a
single known person. Onboarding for strangers, cold-account empty states, and a
depersonalized voice are **not** current requirements.

## Product Purpose

Dispatch is a personal operations dashboard. Its tagline is its mechanism:
**capture in, order out.**

Raw text enters from anywhere with as little friction as possible. An LLM parses
it into structured records — tasks, notes, quotes, journal entries, people,
events — and the system files them where they belong. The structure is surfaced
back as a daily briefing: what today is, what is due, what has been neglected.

Success is that a thought captured in three seconds on a watch face ends up in
the right place without Renan ever filing it by hand, and that opening the app in
the morning tells him what his day is without him assembling it.

It is a functional rebuild of an earlier system (`jerad-ops`); every deliberate
deviation is recorded in `docs/adr/`.

## Positioning

The distinguishing mechanism is the **split between capture and understanding**.
Most task tools ask the user to classify at the moment of entry — pick a list,
pick a project, pick a due date. Dispatch accepts undifferentiated text and does
the classification afterward, asynchronously, and is architecturally forbidden
from losing the input if that classification fails.

Three properties a neighboring product could not truthfully copy without
rebuilding around them:

- **Capture is unconditional.** Persist first, parse second. A parse failure
  degrades to a note flagged `needs_review`; it never drops the text and never
  throws into the capture path.
- **Stewardship domains, not projects.** Work is organized by long-lived areas
  of responsibility, each carrying a definition of what "tended well" looks
  like and the failure patterns that signal neglect — which a cron job actively
  watches for. The system notices absence, not just presence.
- **Everything autonomous is on the record.** Every action the system takes on
  Renan's behalf writes a notification-ledger row.

## Operating Context

- **Surfaces:** Today, Tasks, Inbox, Notes, Projects, People, Journal, Quotes,
  Routines, Links, Notifications, Chat, Settings, More.
- **Intake paths:** the in-app capture palette, an Apple Watch shortcut, the iOS
  share sheet, and `POST /api/capture` — the one and only external surface. A
  bare URL routes to the reading list; anything else goes to the parser.
- **Speech-to-text happens outside the app.** OS dictation or a third-party tool
  produces the text; Dispatch routes the words and never transcribes audio.
- **Recurring rituals:** a morning read of the day (all-day band, timeline,
  top 3, open work), inbox filing, and cron-driven passes — CalDAV pull,
  reminders, neglect sweep.
- **Installed as a PWA on iOS**, so cold starts and session recovery are real
  parts of the usage scene rather than edge cases.

## Capabilities and Constraints

Six invariants govern every surface. They are canonical in
`docs/adr/0041-the-iron-rules.md`, are cited by number at ~70 call sites, and are
never renumbered:

1. **UTC in storage, app timezone at the boundary** (America/Sao_Paulo). All
   calendar logic goes through `lib/dates.ts`.
2. **`requireOwner()` is the security boundary** — first line of every server
   action and session route handler. There is no unauthenticated surface.
3. **Services take `sb` as the first argument**, so the same function runs
   RLS-scoped or service-role.
4. **Never lose a capture.** Degrade to `needs_review`, never drop, never throw
   into the capture path. Capture is text-only.
5. **Bilingual PT-BR/EN.** User content is stored verbatim in whatever language
   it was written and is *never* translated. **UI chrome is English.**
6. **Every autonomous or external action writes a `notifications` row.**

Further durable constraints:

- **Terminology is load-bearing and settled.** `CONTEXT.md` is the glossary;
  words in it are not synonyms to be varied for readability. Notably: *Inbox* is
  the unfiled-task queue at `/inbox` and "triage" is retired; *Links* is the
  reading list; `Today*` is locked to the real calendar today while `Day*`
  follows the date picker; *brief* means only the "In brief" cadence rows, not
  the page.
- **The app shell owns the viewport**, and every route carries a loading
  boundary — a performance decision with direct layout consequences
  (ADR-0028).
- **One task form, in a shared dialog** (ADR-0040).
- **Stack:** Next.js 16 (App Router, cache components), React 19, Tailwind v4,
  Supabase (Postgres/Auth/Storage), Vercel AI SDK via the AI Gateway, Luxon,
  Motion, Tiptap, Sonner, tailwind-variants, Bun, Biome, Vitest. Deployed on
  Vercel.
- **Open:** web-push delivery of the notification ledger is decided (ADR-0005)
  but not shipped.

## Brand Commitments

- **Name:** Dispatch. A dispatch is both a report filed from the field and the
  act of routing work where it belongs; the product is deliberately both.
- **Tagline:** "Capture in, order out."
- **UI voice is English**, terse and operational, using the glossary's exact
  words.
- **No binding visual commitment.** The current Vercel Geist system (ADR-0013)
  is the third styling of this app — editorial/warm-umber, then ElevenLabs
  monochrome, then Geist — and is explicitly **not** binding on future work. The
  incumbent implementation is evidence of what exists, not authority over what
  replaces it. Dark-as-default is likewise a current choice, not a commitment.

## Evidence on Hand

- `README.md` — product description, stack, and the capture-Shortcut setup.
- `CONTEXT.md` — the domain glossary; the source of truth for terminology.
- `docs/adr/0001`–`0041` — every architectural decision with its reasoning.
- `AGENTS.md` — carries an inline mirror of the iron rules; ADR-0041 wins on
  conflict.
- A complete, running implementation of every surface listed above.

There are **no** customers, testimonials, case studies, press mentions, pricing,
usage metrics, or third-party proof of any kind. This is one person's private
instrument. Future work must not invent social proof, adoption numbers, or a
customer-facing narrative for it.

## Product Principles

1. **Capture must cost nothing.** Any friction at the moment of entry defeats
   the product. The system does the sorting afterward; it never asks the user to
   classify first.
2. **The day is assembled for him, not by him.** Opening the app should answer
   "what is today" without the user doing the work of assembly.
3. **Notice absence, not just presence.** Stewardship domains exist so neglect
   becomes visible; a surface that only shows what was done is half the product.
4. **Nothing autonomous happens off the record.** If the system acted for him,
   he can see that it did and, where possible, undo it.
5. **One operator who already knows the tool.** Optimize for fluency and density
   over explanation — without hardcoding one person into the fabric.

## Accessibility & Inclusion

No formal standard has been established for this single-operator tool. Two
product-specific requirements do hold:

- **Bilingual content rendering.** PT-BR and EN text coexist verbatim on the
  same surfaces and must both read correctly; the UI chrome around them stays
  English.
- **Baseline mechanics are non-negotiable regardless:** semantic HTML,
  keyboard-navigable interactive elements, accessible names on icon-only
  controls, and honoring reduced-motion preferences.
