# All AI runs through the Vercel AI Gateway; capture is bilingual and verbatim

One `AI_GATEWAY_API_KEY`; models are plain gateway strings (defaults:
`anthropic/claude-haiku-4.5` for the capture parser, `anthropic/claude-sonnet-5`
for chat), env-overridable in one place. No Anthropic or OpenAI SDKs or keys.
The parser accepts PT-BR and English; captured content is stored verbatim in
the language written — never translated. UI chrome stays English.

The parser is classify-and-extract over a six-verb schema. Haiku is the right
size for that; Sonnet was spending seconds on a judgement that does not need
it. Chat stays on Sonnet. Override `PARSER_MODEL` if a capture starts
mis-filing the task/event boundary.

> **Amended (2026-09-17): `PARSER_MODEL` defaults to Sonnet 5.** "Haiku is the
> right size" was a judgement, never a measurement, and the measurement
> disagrees. On one prompt, scored with `bun run eval:parser`, Haiku 4.5
> dropped the day word from "home: Ask refunds today" in 15 of 15 runs and
> invented a `project` in 8 of 9 runs where none was spoken; Sonnet 5 scored
> 27/27 on the same cases. The "seconds" this ADR was avoiding are hidden by
> the palette's provisional receipt, which never blocks on the parse, and a
> capture is a few hundred tokens — the cost difference is fractions of a cent.
> The override direction is now the other way: drop to Haiku only with an eval
> run that says it is safe.

> **Superseded for transcription (2026-07-20).** An earlier revision of this
> ADR planned gateway multimodal audio transcription
> (`TRANSCRIBE_MODEL` / Whisper alternative). That path was cut — see
> [ADR-0017](./0017-no-in-app-audio-transcription.md). Capture is text-only.

## Why

The reference embedded provider SDKs and two vendor keys; the gateway
collapses that to one credential, one billing surface, and swappable models
(proven in Echo). Verbatim storage because translating someone's journal or
quotes destroys their voice — Echo's translate-to-English rule is right for a
knowledge graph, wrong for a diary.
