# The parser request follows the reference: cached rules, per-call context

Date: 2026-09-19

Compared line by line with jerad-ops `apps/api/src/lib/parser.ts` (the
"Dispatch parser vs Jerad" review, 2026-09-19). Dispatch adopts most of the
reference's request shape and keeps its own schema, guard and transport.

## Decisions

1. **Opus 5 at effort low, for every model call.** `PARSER_MODEL` and
   `CHAT_MODEL` default to `anthropic/claude-opus-5`. Every call sends
   `providerOptions.anthropic.effort = "low"` (`MODEL_PROVIDER_OPTIONS` in
   `lib/ai/gateway.ts`). Measured on the parser eval (28 cases × 4 runs):
   Opus 5 low 112/112, Sonnet 5 low 107/112, same ~1.8s median. With no
   effort set, the model default (`high`) scored worse than `low`. Chat
   quality at `low` is not measured.
2. **The system prompt is static; per-call data goes in the user message.**
   The date, timezone and routing lists go in a `<context>` JSON block, then
   the utterance in `<utterance>` tags. Each project is sent as
   `{name, domain}` so the model sees which domain a project settles. Names
   only, never ids (ADR-0019 D1 stands).
3. **The system prompt is cached.** It is sent as a system message with
   `providerOptions.anthropic.cacheControl = { type: "ephemeral" }`. Both
   prompts are above the Opus 5 floor of 512 tokens (quick-add ~1200,
   palette ~2000 by character count). The cache lives 5 minutes, so it pays
   only when captures land close together. The eval prints cache hits.
4. **Fuzzy routing lands** (`lib/services/capture/match.ts`), superseding the
   exact-only rule of ADR-0019 and the deferral in ADR-0016. The model may
   write the phrase the user said ("the apartment"). `resolveTaskRouting`
   tries the exact name, then the fuzzy match. Two guards the reference does
   not have: fuzzy matching runs only on a phrase the user said (so a model
   stand-in never becomes a filing decision), and a tie is no match.
   A project answer that is exactly a domain name is never fuzzy-matched.
5. **Priority only on a signal.** Signal words in English and pt-BR set 1 or
   2 (or 3). No signal leaves the key out and the database default (3, Low)
   applies. The reference's rule, mapped onto three levels.
6. **Titles drop filler, never reword.** The verbatim guard stays, so the
   reference's "strip filler words" is adopted only as far as the guard
   allows.
7. **Worked examples** in both prompts, in a made-up world that shares no
   names with the eval, so the eval measures rules rather than recall.

## Kept from Dispatch

`generateObject` + zod (the reference's own comment says its plain-JSON path
is a workaround), the AI Gateway (ADR-0004), `maxOutputTokens` 400,
date + time fields in the app timezone, the language rule, recurrence rules,
the "leave the key out" rule, and `needs_review` for ambiguous references
(ADR-0016 D1).

## Consequences

- Any prompt change is measured with `bun run eval:parser` before and after.
  The eval now scores routing as the app files it (after fuzzy matching),
  not the model's raw text.
- Adding a per-call line to the system prompt silently breaks caching. A
  unit test asserts the system prompt is identical across contexts.
