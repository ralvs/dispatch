import { describe, expect, it } from "vitest";
import {
	type CaptureEvent,
	type CaptureState,
	captureMachine,
	initialCaptureState,
} from "@/lib/capture/machine";
import type { CaptureReceipt } from "@/lib/capture/receipt";

const receipt: CaptureReceipt = { tone: "executed", title: "Captured", lines: ["1 task added."] };

describe("captureMachine", () => {
	describe("stale-guard race: close/reopen invalidates an in-flight submit", () => {
		it("ignores a stale SUBMIT_OK after close+reopen, keeping the new draft", () => {
			// Open, type, submit — capture the in-flight seq.
			let t = captureMachine(initialCaptureState, { type: "OPEN", voice: false });
			t = captureMachine(t.state, { type: "TEXT_CHANGED", text: "first draft" });
			t = captureMachine(t.state, { type: "SUBMIT" });
			const staleSeq = t.state.seq;
			expect(t.state.status).toBe("submitting");
			expect(t.effects).toEqual([
				{ type: "SUBMIT", text: "first draft", via: "text", seq: staleSeq },
			]);

			// Close (invalidates the in-flight submit) and reopen with a new draft.
			t = captureMachine(t.state, { type: "CLOSE" });
			expect(t.effects).toEqual([{ type: "RESTORE_FOCUS" }, { type: "CANCEL_SPEECH" }]);
			t = captureMachine(t.state, { type: "OPEN", voice: false });
			t = captureMachine(t.state, { type: "TEXT_CHANGED", text: "second draft" });

			// The stale completion arrives late — it must be a complete no-op.
			const beforeStale = t.state;
			t = captureMachine(t.state, { type: "SUBMIT_OK", seq: staleSeq, receipt });
			expect(t.state).toEqual(beforeStale);
			expect(t.effects).toEqual([]);
			expect(t.state.text).toBe("second draft");
		});

		it("ignores a stale SUBMIT_ERR the same way", () => {
			let t = captureMachine(initialCaptureState, { type: "OPEN", voice: false });
			t = captureMachine(t.state, { type: "TEXT_CHANGED", text: "draft" });
			t = captureMachine(t.state, { type: "SUBMIT" });
			const staleSeq = t.state.seq;
			t = captureMachine(t.state, { type: "CLOSE" });

			const beforeStale = t.state;
			t = captureMachine(t.state, { type: "SUBMIT_ERR", seq: staleSeq, offline: true });
			expect(t.state).toEqual(beforeStale);
			expect(t.effects).toEqual([]);
		});

		it("applies a fresh SUBMIT_OK: receipt set, status done, text cleared", () => {
			let t = captureMachine(initialCaptureState, { type: "OPEN", voice: false });
			t = captureMachine(t.state, { type: "TEXT_CHANGED", text: "draft" });
			t = captureMachine(t.state, { type: "SUBMIT" });
			const seq = t.state.seq;

			t = captureMachine(t.state, { type: "SUBMIT_OK", seq, receipt });
			expect(t.state.status).toBe("done");
			expect(t.state.receipt).toBe(receipt);
			expect(t.state.text).toBe("");
			expect(t.state.usedVoice).toBe(false);
			expect(t.effects).toEqual([{ type: "FOCUS_RECEIPT" }]);
		});
	});

	describe("submit-during-dictation race", () => {
		it("defers the submit until speech ends, then submits the folded text", () => {
			let t = captureMachine(initialCaptureState, { type: "OPEN", voice: true });
			expect(t.state.status).toBe("listening");
			expect(t.effects).toEqual([{ type: "START_SPEECH", baseText: "", lang: "pt-BR" }]);

			t = captureMachine(t.state, { type: "TRANSCRIPT", spoken: "buy milk" });
			expect(t.state.text).toBe("buy milk");
			expect(t.state.usedVoice).toBe(true);

			// SUBMIT while listening defers — no seq bump yet, just STOP_SPEECH.
			const seqBefore = t.state.seq;
			t = captureMachine(t.state, { type: "SUBMIT" });
			expect(t.state.submitAfterStop).toBe(true);
			expect(t.state.seq).toBe(seqBefore);
			expect(t.state.status).toBe("listening");
			expect(t.effects).toEqual([{ type: "STOP_SPEECH" }]);

			// A final transcript chunk can still land before the recognizer settles.
			t = captureMachine(t.state, { type: "TRANSCRIPT", spoken: "buy milk and eggs" });
			expect(t.state.text).toBe("buy milk and eggs");

			// Recognition ends: fold complete, now actually submit.
			t = captureMachine(t.state, { type: "SPEECH_ENDED" });
			expect(t.state.submitAfterStop).toBe(false);
			expect(t.state.status).toBe("submitting");
			expect(t.state.seq).toBe(seqBefore + 1);
			expect(t.effects).toEqual([
				{ type: "SUBMIT", text: "buy milk and eggs", via: "voice", seq: seqBefore + 1 },
			]);
		});

		it("SPEECH_ENDED without a deferred submit just falls back to editing", () => {
			let t = captureMachine(initialCaptureState, { type: "OPEN", voice: true });
			t = captureMachine(t.state, { type: "SPEECH_ENDED" });
			expect(t.state.status).toBe("editing");
			expect(t.state.submitAfterStop).toBe(false);
			expect(t.effects).toEqual([]);
		});
	});

	describe("offline retry race", () => {
		it("SUBMIT_ERR with offline:true sets error+offlineError, keeping text", () => {
			let t = captureMachine(initialCaptureState, { type: "OPEN", voice: false });
			t = captureMachine(t.state, { type: "TEXT_CHANGED", text: "draft" });
			t = captureMachine(t.state, { type: "SUBMIT" });
			const seq = t.state.seq;

			t = captureMachine(t.state, { type: "SUBMIT_ERR", seq, offline: true });
			expect(t.state.status).toBe("error");
			expect(t.state.offlineError).toBe(true);
			expect(t.state.text).toBe("draft");
			expect(t.effects).toEqual([]);
		});

		it("ONLINE while status error && offlineError retries with a bumped seq", () => {
			let t = captureMachine(initialCaptureState, { type: "OPEN", voice: false });
			t = captureMachine(t.state, { type: "TEXT_CHANGED", text: "draft" });
			t = captureMachine(t.state, { type: "SUBMIT" });
			const seq = t.state.seq;
			t = captureMachine(t.state, { type: "SUBMIT_ERR", seq, offline: true });

			t = captureMachine(t.state, { type: "ONLINE" });
			expect(t.state.status).toBe("submitting");
			expect(t.state.seq).toBe(seq + 1);
			expect(t.effects).toEqual([{ type: "SUBMIT", text: "draft", via: "text", seq: seq + 1 }]);
		});

		it("ONLINE when idle (or error without offlineError) no-ops", () => {
			const idleResult = captureMachine(initialCaptureState, { type: "ONLINE" });
			expect(idleResult.state).toEqual(initialCaptureState);
			expect(idleResult.effects).toEqual([]);

			let t = captureMachine(initialCaptureState, { type: "OPEN", voice: false });
			t = captureMachine(t.state, { type: "TEXT_CHANGED", text: "draft" });
			t = captureMachine(t.state, { type: "SUBMIT" });
			const seq = t.state.seq;
			t = captureMachine(t.state, { type: "SUBMIT_ERR", seq, offline: false });

			const before = t.state;
			t = captureMachine(t.state, { type: "ONLINE" });
			expect(t.state).toEqual(before);
			expect(t.effects).toEqual([]);
		});
	});

	describe("text-preservation invariant", () => {
		const events: CaptureEvent[] = [
			{ type: "OPEN", voice: false },
			{ type: "OPEN", voice: false, prefill: "Task: " },
			{ type: "CLOSE" },
			{ type: "OPEN", voice: true },
			{ type: "TRANSCRIPT", spoken: "hello" },
			{ type: "MIC_TOGGLED" },
			{ type: "LANG_TOGGLED" },
			{ type: "SPEECH_ENDED" },
			{ type: "SUBMIT" },
			{ type: "SUBMIT_ERR", seq: 999, offline: true },
			{ type: "ONLINE" },
			{ type: "CAPTURE_ANOTHER" },
		];

		it("never clears text except on a fresh SUBMIT_OK", () => {
			// TEXT_CHANGED/TRANSCRIPT legitimately change the draft's content, but no
			// event may ever blank it out except a fresh SUBMIT_OK.
			let state: CaptureState = { ...initialCaptureState, text: "precious draft" };
			for (const event of events) {
				state = captureMachine(state, event).state;
				if (event.type === "SUBMIT_OK") {
					expect(state.text).toBe("");
				} else {
					expect(state.text).not.toBe("");
				}
			}
		});

		it("a fresh SUBMIT_OK is the only event that clears text", () => {
			let t = captureMachine(
				{ ...initialCaptureState, text: "precious draft", open: true, status: "editing" },
				{ type: "SUBMIT" },
			);
			const seq = t.state.seq;
			expect(t.state.text).toBe("precious draft");
			t = captureMachine(t.state, { type: "SUBMIT_OK", seq, receipt });
			expect(t.state.text).toBe("");
		});
	});

	describe("OPEN prefill (Today's capture chips)", () => {
		it("seeds an empty palette with the chip's kind hint", () => {
			const t = captureMachine(initialCaptureState, {
				type: "OPEN",
				voice: false,
				prefill: "Task: ",
			});
			expect(t.state.text).toBe("Task: ");
			expect(t.state.status).toBe("editing");
		});

		it("never overwrites an unsubmitted draft", () => {
			const t = captureMachine(
				{ ...initialCaptureState, text: "half a thought" },
				{ type: "OPEN", voice: false, prefill: "Task: " },
			);
			expect(t.state.text).toBe("half a thought");
		});

		it("treats a whitespace-only draft as empty", () => {
			const t = captureMachine(
				{ ...initialCaptureState, text: "   \n " },
				{ type: "OPEN", voice: false, prefill: "Note: " },
			);
			expect(t.state.text).toBe("Note: ");
		});

		it("ignores a prefill on a voice open, which starts its own base", () => {
			const t = captureMachine(initialCaptureState, {
				type: "OPEN",
				voice: true,
				prefill: "Task: ",
			});
			expect(t.state.text).toBe("");
			expect(t.state.speechBase).toBe("");
			expect(t.effects).toEqual([{ type: "START_SPEECH", baseText: "", lang: "pt-BR" }]);
		});

		it("leaves text alone when no prefill is sent", () => {
			const t = captureMachine(initialCaptureState, { type: "OPEN", voice: false });
			expect(t.state.text).toBe("");
		});
	});

	describe("lang/mic toggles", () => {
		it("MIC_TOGGLED starting dictation snapshots speechBase and emits START_SPEECH", () => {
			let t = captureMachine(initialCaptureState, { type: "OPEN", voice: false });
			t = captureMachine(t.state, { type: "TEXT_CHANGED", text: "typed so far" });
			t = captureMachine(t.state, { type: "MIC_TOGGLED" });
			expect(t.state.status).toBe("listening");
			expect(t.state.speechBase).toBe("typed so far");
			expect(t.effects).toEqual([
				{ type: "START_SPEECH", baseText: "typed so far", lang: "pt-BR" },
			]);
		});

		it("MIC_TOGGLED while listening emits STOP_SPEECH without changing status yet", () => {
			let t = captureMachine(initialCaptureState, { type: "OPEN", voice: true });
			t = captureMachine(t.state, { type: "MIC_TOGGLED" });
			expect(t.state.status).toBe("listening");
			expect(t.effects).toEqual([{ type: "STOP_SPEECH" }]);
		});

		it("LANG_TOGGLED flips lang and stops dictation", () => {
			let t = captureMachine(initialCaptureState, { type: "OPEN", voice: true });
			t = captureMachine(t.state, { type: "LANG_TOGGLED" });
			expect(t.state.lang).toBe("en-US");
			expect(t.effects).toEqual([{ type: "STOP_SPEECH" }]);

			t = captureMachine(t.state, { type: "LANG_TOGGLED" });
			expect(t.state.lang).toBe("pt-BR");
		});
	});

	describe("misc transitions", () => {
		it("SUBMIT on a blank draft is a no-op", () => {
			const t = captureMachine(initialCaptureState, { type: "SUBMIT" });
			expect(t.state).toEqual(initialCaptureState);
			expect(t.effects).toEqual([]);
		});

		it("SUBMIT while already submitting is a no-op", () => {
			const submitting: CaptureState = {
				...initialCaptureState,
				open: true,
				text: "draft",
				status: "submitting",
				seq: 3,
			};
			const t = captureMachine(submitting, { type: "SUBMIT" });
			expect(t.state).toEqual(submitting);
			expect(t.effects).toEqual([]);
		});

		it("CAPTURE_ANOTHER resets to editing, clears receipt, focuses textarea", () => {
			const done: CaptureState = {
				...initialCaptureState,
				open: true,
				status: "done",
				receipt,
			};
			const t = captureMachine(done, { type: "CAPTURE_ANOTHER" });
			expect(t.state.status).toBe("editing");
			expect(t.state.receipt).toBeNull();
			expect(t.effects).toEqual([{ type: "FOCUS_TEXTAREA" }]);
		});

		it("CLOSE bumps seq and emits RESTORE_FOCUS + CANCEL_SPEECH", () => {
			const open: CaptureState = { ...initialCaptureState, open: true, status: "editing", seq: 2 };
			const t = captureMachine(open, { type: "CLOSE" });
			expect(t.state.open).toBe(false);
			expect(t.state.status).toBe("idle");
			expect(t.state.seq).toBe(3);
			expect(t.effects).toEqual([{ type: "RESTORE_FOCUS" }, { type: "CANCEL_SPEECH" }]);
		});
	});
});
