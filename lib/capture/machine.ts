// Pure state machine for the capture palette (docs/adr/0009 precedent: same
// testing philosophy as lib/debounced-save.ts — no DOM, no timers, no React,
// every transition is a data-in/data-out function). The palette component
// drains the effects this emits; the machine itself never touches the world.
//
// Iron rule #4 (never lose a capture) is encoded structurally: `text` is
// never cleared by any transition except a *fresh* SUBMIT_OK.

import type { CaptureReceipt } from "@/lib/capture/receipt";
import { isBlank, isStaleSubmission } from "@/lib/capture/submission";

export type CaptureStatus = "idle" | "editing" | "submitting" | "done" | "error";

export type CaptureState = {
	status: CaptureStatus;
	open: boolean;
	// NEVER cleared except on a fresh SUBMIT_OK (iron rule #4).
	text: string;
	// Monotonic submission guard, paired with isStaleSubmission.
	seq: number;
	// Whether the browser was offline at the moment of the last failure.
	offlineError: boolean;
	receipt: CaptureReceipt | null;
};

export const initialCaptureState: CaptureState = {
	status: "idle",
	open: false,
	text: "",
	seq: 0,
	offlineError: false,
	receipt: null,
};

export type CaptureEvent =
	| { type: "OPEN"; prefill?: string }
	| { type: "CLOSE" }
	| { type: "TEXT_CHANGED"; text: string }
	| { type: "SUBMIT" }
	| { type: "SUBMIT_OK"; seq: number; receipt: CaptureReceipt }
	| { type: "SUBMIT_ERR"; seq: number; offline: boolean }
	| { type: "ONLINE" }
	| { type: "CAPTURE_ANOTHER" };

export type CaptureEffect =
	| { type: "SUBMIT"; text: string; seq: number }
	| { type: "FOCUS_TEXTAREA" }
	| { type: "FOCUS_RECEIPT" }
	| { type: "RESTORE_FOCUS" };

export type CaptureTransition = { state: CaptureState; effects: CaptureEffect[] };

/** Shown immediately on submit (A-lite progressive UX) until the SA settles. */
export const RECORDING_RECEIPT: CaptureReceipt = {
	tone: "recorded_only",
	title: "Recorded",
	lines: ["Your words are safe.", "Filing them now…"],
};

// Shared by a fresh SUBMIT and the ONLINE retry: bump the sequence, move to
// "submitting", show a provisional receipt, and emit the SUBMIT effect.
function beginSubmit(state: CaptureState): CaptureTransition {
	const seq = state.seq + 1;
	return {
		state: {
			...state,
			seq,
			status: "submitting",
			receipt: RECORDING_RECEIPT,
			offlineError: false,
		},
		effects: [{ type: "SUBMIT", text: state.text, seq }],
	};
}

export function captureMachine(state: CaptureState, event: CaptureEvent): CaptureTransition {
	switch (event.type) {
		case "OPEN": {
			// A prefill seeds an EMPTY palette only — overwriting an unsubmitted
			// draft would lose a capture (iron rule #4).
			const prefill = event.prefill;
			const text = prefill !== undefined && isBlank(state.text) ? prefill : state.text;
			return {
				state: { ...state, open: true, text, status: "editing" },
				effects: [],
			};
		}

		case "CLOSE": {
			return {
				state: {
					...state,
					seq: state.seq + 1,
					open: false,
					status: "idle",
					offlineError: false,
					receipt: null,
				},
				effects: [{ type: "RESTORE_FOCUS" }],
			};
		}

		case "TEXT_CHANGED": {
			return { state: { ...state, text: event.text }, effects: [] };
		}

		case "SUBMIT": {
			if (isBlank(state.text)) return { state, effects: [] };
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
				},
				effects: [{ type: "FOCUS_RECEIPT" }],
			};
		}

		case "SUBMIT_ERR": {
			if (isStaleSubmission(event.seq, state.seq)) return { state, effects: [] };
			return {
				state: {
					...state,
					status: "error",
					offlineError: event.offline,
					// Drop provisional receipt so the form + error show again.
					receipt: null,
				},
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
