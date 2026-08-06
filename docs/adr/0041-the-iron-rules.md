# The iron rules live here, numbered and stable

Six invariants hold across every surface of this app. They were previously
stated in `CLAUDE.md` and `AGENTS.md` — hand-maintained duplicates of one
list — while the decisions behind them lived in ADRs. That put the normative
text in an agent-config file and the reasoning somewhere else. This ADR is now
the canonical statement; each rule links to the ADR that decided it.

**The numbering is a stable interface.** Roughly seventy call sites cite these
rules by number — source comments, tests, ADRs, and design docs all say things
like "iron rule #4" rather than restating the constraint. Rules are never
renumbered and never reordered. A retired rule keeps its number and is marked
superseded in place; new rules append.

## The rules

1. **UTC in storage, app timezone at the boundary.** Every persisted timestamp
   is UTC (`timestamptz`). Day boundaries, display, and natural-language date
   parsing go through `lib/dates.ts` with the timezone from `app_settings`
   (America/Sao_Paulo). Never raw `new Date()` math for calendar logic.
   → ADR-0002.
2. **`requireOwner()` is the security boundary** — first line of every server
   action and session route handler. `proxy.ts` only refreshes sessions and
   redirects page loads. External endpoints use `lib/secret-auth.ts`
   (timing-safe). There is no unauthenticated surface. → ADR-0003.
3. **Services take `sb` as the first argument** so the same function runs
   RLS-scoped (pages/actions) or service-role (cron/capture). → ADR-0001.
4. **Never lose a capture.** The capture pipeline degrades to a `needs_review`
   note rather than dropping input. AI calls return typed fallbacks, never
   throw into the capture path. Capture is text-only. → ADR-0008, ADR-0017.
5. **Bilingual PT-BR/EN.** Content is stored verbatim in the language written —
   never translated. UI chrome is English. → ADR-0009, ADR-0012.
6. **Every autonomous/external action writes a `notifications` row**, through
   `recordNotification` as the one sanctioned write path. Best-effort: a failed
   ledger write never rolls back the durable record. Synchronous user-initiated
   mutations are out of scope. → ADR-0015.

## Why

Rules 2, 4, and 6 are the ones that fail silently. A missing `requireOwner()`
does not throw — it serves owner data to nobody in particular. A capture that
throws instead of degrading loses input the user cannot reproduce, because the
raw text is gone. A missing ledger row leaves an action the system took on
Renan's behalf with no record that it happened. None of the three is caught by
types or tests, so each one is stated as a rule and cited at the seam where it
could be violated.

Rules 1, 3, and 5 are cheap to follow and expensive to retrofit. Timezone bugs
surface as off-by-one days weeks later; a service that captures its own client
cannot be reused from cron; a translation applied once is unrecoverable.

## Consequences

`CLAUDE.md` is deleted — this ADR plus `AGENTS.md` cover it, and `docs/adr/`
was already the place a session is told to read before changing direction.
`AGENTS.md` keeps the rules inline: it is the file cross-tool agents load
automatically, and these six are worth carrying in context rather than
fetching. That inline copy is a mirror of this ADR, and this ADR wins on
conflict.
