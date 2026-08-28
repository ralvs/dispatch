// Pure state machine for the capture palette (docs/adr/0009 precedent: same
// testing philosophy as lib/debounced-save.ts — no DOM, no timers, no React,
// every transition is a data-in/data-out function). The palette component
// drains the effects this emits; the machine itself never touches the world.
//
// The palette is a QUEUE, not a single submission. Capturing is a stream of
// short thoughts, and the parser takes seconds (p50 ~4s, tail ~17s), so making
// the composer wait for a receipt made the user hold five thoughts in their
// head while the first one filed. Each submit becomes a `slip` that settles on
// its own; the composer clears and stays open for the next one.
//
// Iron rule #4 (never lose a capture) is encoded structurally: the submitted
// text moves from `text` into its slip in the SAME transition that emits the
// SUBMIT effect, and a slip is only ever dropped once it has settled `done`.
// A failed slip keeps its text and offers a retry, so no path drops words.

import type { CaptureReceipt } from "@/lib/capture/receipt";
import { isBlank } from "@/lib/capture/submission";

/** One submitted capture, in flight or settled. */
export type CaptureSlip = {
	// Monotonic; matches the id carried by the SUBMIT effect and echoed back on
	// SUBMIT_OK / SUBMIT_ERR. Replaces the old single `seq` guard: a late reply
	// is now matched to its own slip instead of invalidating the whole palette.
	id: number;
	// The verbatim submitted text. Never cleared while the slip lives — this is
	// what makes a retry (and iron rule #4) possible after the composer moved on.
	text: string;
	status: "submitting" | "done" | "error";
	// Whether the browser was offline at the moment this slip failed.
	offline: boolean;
	receipt: CaptureReceipt | null;
};

export type CaptureState = {
	open: boolean;
	// The composer draft ONLY. Cleared on submit because the words are safe in
	// the slip, not because they were discarded.
	text: string;
	// Monotonic slip-id source.
	seq: number;
	// In-flight and recently settled slips, oldest first.
	slips: CaptureSlip[];
};

export const initialCaptureState: CaptureState = {
	open: false,
	text: "",
	seq: 0,
	slips: [],
};

export type CaptureEvent =
	| { type: "OPEN"; prefill?: string }
	| { type: "CLOSE" }
	| { type: "TEXT_CHANGED"; text: string }
	| { type: "SUBMIT" }
	| { type: "SUBMIT_OK"; id: number; receipt: CaptureReceipt }
	| { type: "SUBMIT_ERR"; id: number; offline: boolean }
	| { type: "ONLINE" }
	| { type: "RETRY"; id: number }
	| { type: "DISMISS"; id: number };

export type CaptureEffect =
	| { type: "SUBMIT"; text: string; id: number }
	| { type: "FOCUS_TEXTAREA" }
	| { type: "RESTORE_FOCUS" };

export type CaptureTransition = { state: CaptureState; effects: CaptureEffect[] };

/** Shown on a slip from the moment it is submitted until the SA settles. */
export const RECORDING_RECEIPT: CaptureReceipt = {
	tone: "recorded_only",
	title: "Recorded",
	lines: ["Your words are safe.", "Filing them now…"],
};

/** Is anything still in flight? The composer never blocks on this — callers use
 * it for the live-region summary and to decide whether closing needs a word. */
export function hasPendingSlips(state: CaptureState): boolean {
	return state.slips.some((slip) => slip.status === "submitting");
}

function replaceSlip(
	slips: CaptureSlip[],
	id: number,
	update: (slip: CaptureSlip) => CaptureSlip,
): CaptureSlip[] {
	return slips.map((slip) => (slip.id === id ? update(slip) : slip));
}

/** Shared by a fresh SUBMIT, a manual RETRY, and the ONLINE sweep. */
function beginSlip(state: CaptureState, text: string): CaptureTransition {
	const id = state.seq + 1;
	const slip: CaptureSlip = {
		id,
		text,
		status: "submitting",
		offline: false,
		receipt: RECORDING_RECEIPT,
	};
	return {
		state: { ...state, seq: id, slips: [...state.slips, slip] },
		effects: [{ type: "SUBMIT", text, id }],
	};
}

export function captureMachine(state: CaptureState, event: CaptureEvent): CaptureTransition {
	switch (event.type) {
		case "OPEN": {
			// A prefill seeds an EMPTY composer only — overwriting an unsubmitted
			// draft would lose a capture (iron rule #4).
			const prefill = event.prefill;
			const text = prefill !== undefined && isBlank(state.text) ? prefill : state.text;
			return { state: { ...state, open: true, text }, effects: [] };
		}

		case "CLOSE": {
			// Closing does NOT cancel anything — the server action is already in
			// flight and completes regardless (verified against Next 16). Settled
			// slips have been seen, so they are dropped; in-flight and failed ones
			// survive, so reopening still shows what is working and what needs a
			// retry. The old CLOSE bumped a global seq to invalidate the reply,
			// which left the submitted text sitting in the composer and invited a
			// duplicate submit on reopen.
			return {
				state: {
					...state,
					open: false,
					slips: state.slips.filter((slip) => slip.status !== "done"),
				},
				effects: [{ type: "RESTORE_FOCUS" }],
			};
		}

		case "TEXT_CHANGED": {
			return { state: { ...state, text: event.text }, effects: [] };
		}

		case "SUBMIT": {
			if (isBlank(state.text)) return { state, effects: [] };
			// The composer clears and refocuses so the next thought can be typed
			// while this one files. Concurrent submits are the point, so there is
			// no "already submitting" guard any more.
			const begun = beginSlip(state, state.text);
			return {
				state: { ...begun.state, text: "" },
				effects: [...begun.effects, { type: "FOCUS_TEXTAREA" }],
			};
		}

		case "SUBMIT_OK": {
			return {
				state: {
					...state,
					slips: replaceSlip(state.slips, event.id, (slip) => ({
						...slip,
						status: "done",
						offline: false,
						receipt: event.receipt,
					})),
				},
				effects: [],
			};
		}

		case "SUBMIT_ERR": {
			return {
				state: {
					...state,
					slips: replaceSlip(state.slips, event.id, (slip) => ({
						...slip,
						status: "error",
						offline: event.offline,
						// Drop the provisional receipt so the failure reads as one.
						receipt: null,
					})),
				},
				effects: [],
			};
		}

		case "RETRY": {
			const failed = state.slips.find((slip) => slip.id === event.id);
			if (!failed || failed.status !== "error") return { state, effects: [] };
			// A retry is a new slip: the old one is dropped only once its text has
			// been carried into the replacement, so the words are never unowned.
			const pruned = { ...state, slips: state.slips.filter((slip) => slip.id !== event.id) };
			return beginSlip(pruned, failed.text);
		}

		case "ONLINE": {
			// Reconnecting retries every slip that failed *because* we were offline.
			// Slips that failed for another reason wait for a manual retry.
			const stranded = state.slips.filter((slip) => slip.status === "error" && slip.offline);
			if (stranded.length === 0) return { state, effects: [] };

			let next: CaptureState = {
				...state,
				slips: state.slips.filter((slip) => !(slip.status === "error" && slip.offline)),
			};
			const effects: CaptureEffect[] = [];
			for (const slip of stranded) {
				const begun = beginSlip(next, slip.text);
				next = begun.state;
				effects.push(...begun.effects);
			}
			return { state: next, effects };
		}

		case "DISMISS": {
			// Only a settled slip can be dismissed; an in-flight one has nowhere
			// else to live, and a failed one still holds unsaved words.
			const slip = state.slips.find((s) => s.id === event.id);
			if (!slip || slip.status !== "done") return { state, effects: [] };
			return {
				state: { ...state, slips: state.slips.filter((s) => s.id !== event.id) },
				effects: [],
			};
		}

		default: {
			const _exhaustive: never = event;
			return { state, effects: [] };
		}
	}
}
