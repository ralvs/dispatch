# All AI runs through the Vercel AI Gateway; capture is bilingual and verbatim

One `AI_GATEWAY_API_KEY`; models are plain gateway strings (defaults:
`anthropic/claude-sonnet-5` for the capture parser and chat), env-overridable
in one place. No Anthropic or OpenAI SDKs or keys. The parser accepts PT-BR
and English; captured content is stored verbatim in the language written —
never translated. UI chrome stays English.

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
