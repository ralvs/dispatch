import "server-only";

// ─────────────────────────────────────────────────────────────────────────
// Audio -> text seam (docs/adr/0004: transcription is a gateway multimodal
// call, not a dedicated speech API). DEFERRED for v1: the palette sends a text
// transcript (Web Speech client-side or typed), so no audio reaches capture yet.
//
// The seam exists so the audio path can land later without reshaping the
// pipeline. Like the parser, it returns a typed fallback and never throws into
// the capture path. The stub always reports "unavailable".
// ─────────────────────────────────────────────────────────────────────────

export type TranscribeResult =
	| { ok: true; text: string }
	| { ok: false; reason: "unavailable" | "failed"; error?: string };

export function transcribe(_input: {
	audio: ArrayBuffer;
	mimeType: string;
}): Promise<TranscribeResult> {
	return Promise.resolve({ ok: false, reason: "unavailable" });
}
