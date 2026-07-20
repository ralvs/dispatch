// Pure state machine for the capture palette (docs/adr/0009 precedent: same
// testing philosophy as lib/debounced-save.ts — no DOM, no timers, no React,
// every transition is a data-in/data-out function). The palette component
// drains the effects this emits; the machine itself never touches the world.
//
// Iron rule #4 (never lose a capture) is encoded structurally: `text` is
// never cleared by any transition except a *fresh* SUBMIT_OK.

import type { CaptureReceipt } from "@/lib/capture/receipt";
import { joinSpoken, nextLang, type RecognitionLang } from "@/lib/capture/speech";
import { isBlank, isStaleSubmission } from "@/lib/capture/submission";

export type CaptureStatus = "idle" | "editing" | "listening" | "submitting" | "done" | "error";

export type CaptureState = {
	status: CaptureStatus;
	open: boolean;
	// NEVER cleared except on a fresh SUBMIT_OK (iron rule #4).
	text: string;
	// Text snapshot captured when dictation started, so recognised speech
	// composes onto it rather than replacing it.
	speechBase: string;
	// Whether the current draft came (even partly) from the mic — decides `via`.
	usedVoice: boolean;
	lang: RecognitionLang;
	// Monotonic submission guard, paired with isStaleSubmission.
	seq: number;
	// Set when SUBMIT arrives mid-dictation: the request is deferred until
	// recognition ends so a final result can't land after the snapshot.
	submitAfterStop: boolean;
	// Whether the browser was offline at the moment of the last failure.
	offlineError: boolean;
	receipt: CaptureReceipt | null;
};

export const initialCaptureState: CaptureState = {
	status: "idle",
	open: false,
	text: "",
	speechBase: "",
	usedVoice: false,
	lang: "pt-BR",
	seq: 0,
	submitAfterStop: false,
	offlineError: false,
	receipt: null,
};

export type CaptureEvent =
	| { type: "OPEN"; voice: boolean; prefill?: string }
	| { type: "CLOSE" }
	| { type: "TEXT_CHANGED"; text: string }
	| { type: "TRANSCRIPT"; spoken: string }
	| { type: "MIC_TOGGLED" }
	| { type: "LANG_TOGGLED" }
	| { type: "SPEECH_ENDED" }
	| { type: "SUBMIT" }
	| { type: "SUBMIT_OK"; seq: number; receipt: CaptureReceipt }
	| { type: "SUBMIT_ERR"; seq: number; offline: boolean }
	| { type: "ONLINE" }
	| { type: "CAPTURE_ANOTHER" };

export type CaptureEffect =
	| { type: "START_SPEECH"; baseText: string; lang: RecognitionLang }
	| { type: "STOP_SPEECH" }
	| { type: "CANCEL_SPEECH" }
	| { type: "SUBMIT"; text: string; via: "voice" | "text"; seq: number }
	| { type: "FOCUS_TEXTAREA" }
	| { type: "FOCUS_RECEIPT" }
	| { type: "RESTORE_FOCUS" };

export type CaptureTransition = { state: CaptureState; effects: CaptureEffect[] };

function via(state: CaptureState): "voice" | "text" {
	return state.usedVoice ? "voice" : "text";
}

// Shared by a fresh SUBMIT and the ONLINE retry: bump the sequence, move to
// "submitting", and emit the SUBMIT effect with the freshly bumped seq.
function beginSubmit(state: CaptureState): CaptureTransition {
	const seq = state.seq + 1;
	return {
		state: { ...state, seq, status: "submitting" },
		effects: [{ type: "SUBMIT", text: state.text, via: via(state), seq }],
	};
}

export function captureMachine(state: CaptureState, event: CaptureEvent): CaptureTransition {
	switch (event.type) {
		case "OPEN": {
			// A prefill seeds an EMPTY palette only — overwriting an unsubmitted
			// draft would lose a capture (iron rule #4). Voice opens ignore it:
			// dictation composes onto its own base, below.
			const prefill = event.prefill;
			const text =
				!event.voice && prefill !== undefined && isBlank(state.text) ? prefill : state.text;
			const next: CaptureState = {
				...state,
				open: true,
				text,
				status: event.voice ? "listening" : "editing",
			};
			if (event.voice) {
				// Matches current behaviour: opening via the voice trigger starts a
				// fresh dictation base ("") rather than composing onto whatever draft
				// (if any) is still sitting in `text` from a prior unsubmitted session.
				// MIC_TOGGLED, by contrast, composes onto the current text.
				return {
					state: { ...next, speechBase: "" },
					effects: [{ type: "START_SPEECH", baseText: "", lang: state.lang }],
				};
			}
			return { state: next, effects: [] };
		}

		case "CLOSE": {
			return {
				state: {
					...state,
					seq: state.seq + 1,
					open: false,
					status: "idle",
					submitAfterStop: false,
					offlineError: false,
					receipt: null,
				},
				effects: [{ type: "RESTORE_FOCUS" }, { type: "CANCEL_SPEECH" }],
			};
		}

		case "TEXT_CHANGED": {
			return { state: { ...state, text: event.text }, effects: [] };
		}

		case "TRANSCRIPT": {
			return {
				state: {
					...state,
					text: joinSpoken(state.speechBase, event.spoken),
					usedVoice: true,
				},
				effects: [],
			};
		}

		case "MIC_TOGGLED": {
			if (state.status === "listening") {
				return { state, effects: [{ type: "STOP_SPEECH" }] };
			}
			return {
				state: { ...state, speechBase: state.text, status: "listening" },
				effects: [{ type: "START_SPEECH", baseText: state.text, lang: state.lang }],
			};
		}

		case "LANG_TOGGLED": {
			return {
				state: { ...state, lang: nextLang(state.lang) },
				effects: [{ type: "STOP_SPEECH" }],
			};
		}

		case "SPEECH_ENDED": {
			if (state.submitAfterStop) {
				const seq = state.seq + 1;
				return {
					state: { ...state, seq, status: "submitting", submitAfterStop: false },
					effects: [{ type: "SUBMIT", text: state.text, via: via(state), seq }],
				};
			}
			// Mic turned off but the palette is still open: fall back to editing.
			if (state.status === "listening") {
				return { state: { ...state, status: "editing" }, effects: [] };
			}
			return { state, effects: [] };
		}

		case "SUBMIT": {
			if (isBlank(state.text)) return { state, effects: [] };
			if (state.status === "listening") {
				return { state: { ...state, submitAfterStop: true }, effects: [{ type: "STOP_SPEECH" }] };
			}
			if (state.status === "submitting") return { state, effects: [] };
			return beginSubmit(state);
		}

		case "SUBMIT_OK": {
			if (isStaleSubmission(event.seq, state.seq)) return { state, effects: [] };
			return {
				state: {
					...state,
					status: "done",
					receipt: event.receipt,
					text: "",
					usedVoice: false,
				},
				effects: [{ type: "FOCUS_RECEIPT" }],
			};
		}

		case "SUBMIT_ERR": {
			if (isStaleSubmission(event.seq, state.seq)) return { state, effects: [] };
			return {
				state: { ...state, status: "error", offlineError: event.offline },
				effects: [],
			};
		}

		case "ONLINE": {
			if (state.status === "error" && state.offlineError) return beginSubmit(state);
			return { state, effects: [] };
		}

		case "CAPTURE_ANOTHER": {
			return {
				state: { ...state, status: "editing", receipt: null },
				effects: [{ type: "FOCUS_TEXTAREA" }],
			};
		}

		default: {
			const _exhaustive: never = event;
			return { state, effects: [] };
		}
	}
}
