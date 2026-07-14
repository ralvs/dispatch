# All AI runs through the Vercel AI Gateway; capture is bilingual and verbatim

One `AI_GATEWAY_API_KEY`; models are plain gateway strings (defaults:
`anthropic/claude-sonnet-5` for the voice parser and chat,
`google/gemini-2.5-flash` for transcription), env-overridable in one place.
No Anthropic or OpenAI SDKs or keys. Transcription is a multimodal
message (audio file part → text), not a dedicated speech API. The parser
accepts PT-BR and English; captured content is stored verbatim in the language
spoken — never translated. UI chrome stays English.

## Why

The reference embedded provider SDKs and two vendor keys; the gateway
collapses that to one credential, one billing surface, and swappable models
(proven in Echo). Whisper was dropped because a gateway-routed multimodal
model transcribes PT-BR well without a second vendor. Verbatim storage because
translating someone's journal or quotes destroys their voice — Echo's
translate-to-English rule is right for a knowledge graph, wrong for a diary.
