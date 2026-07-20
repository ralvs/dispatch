# No in-app audio transcription

Date: 2026-07-20

## Context

Dispatch once planned (and partially stubbed) two ways to turn speech into
text inside the app:

1. Browser **Web Speech** dictation in the capture palette (shipped).
2. A server-side **gateway multimodal transcriber** for recorded audio
   (`lib/ai/transcriber.ts` stub, ADR-0004 / ADR-0016 Decision 2, plan items
   6–8 in `docs/capture-vocabulary-2026-07-20.md`).

In practice the owner already transcribes outside Dispatch — a Mac
dictation/transcription app, and the iPhone's own transcription. Keeping a
third path in the app duplicated work, added surface area (mic permissions,
recognition race logic, a planned MediaRecorder + storage path), and pulled
attention away from capture-as-routing.

## Decision

**Dispatch does not transcribe audio.** Capture is text-only: type or paste
into the palette (or send text via external ingest). Speech-to-text happens
elsewhere; the user brings the words.

Concretely:

- Removed Web Speech glue (`lib/capture/speech.ts`,
  `use-speech-capture.ts`), mic/lang UI, and speech states from the capture
  machine.
- Removed the transcriber stub and `TRANSCRIBE_MODEL`.
- Supersedes **ADR-0016 Decision 2** (audio capture + failed-transcription
  note). Decision 1 (ambiguity → `needs_review`) still stands.
- Plan items 6–8 of the capture-vocabulary plan are **cancelled**.

Historical provenance values (`via: "voice"`, journal `source: "voice"`,
quote `added_via: "voice"`, task `source: "voice"`) remain valid DB enums
for rows that already have them or for external senders that transcribed
elsewhere. The palette always submits `via: "text"`.

Journal column `transcription_text` is the entry body field name in the
schema — not an in-app transcription feature. Left as-is.

## Why

Duplication with OS/third-party tools the owner already uses. Text is the
durable capture input; parsing and routing are the product.

## Consequences

- Capture palette is a text modal (⌘J / FAB / chips).
- Manifest shortcut opens `?capture=1` (legacy `?capture=voice` still opens
  the palette, without starting dictation).
- `captured_data.type` for palette rows is `text_capture` (was
  `voice_capture`).
- Executor writes tasks/quotes/journal from capture as manual/typed
  provenance, not voice.
