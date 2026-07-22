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
			let t = captureMachine(initialCaptureState, { type: "OPEN" });
			t = captureMachine(t.state, { type: "TEXT_CHANGED", text: "first draft" });
			t = captureMachine(t.state, { type: "SUBMIT" });
			const staleSeq = t.state.seq;
			expect(t.state.status).toBe("submitting");
			expect(t.state.receipt?.title).toBe("Recorded");
			expect(t.effects).toEqual([{ type: "SUBMIT", text: "first draft", seq: staleSeq }]);

			// Close (invalidates the in-flight submit) and reopen with a new draft.
			t = captureMachine(t.state, { type: "CLOSE" });
			expect(t.effects).toEqual([{ type: "RESTORE_FOCUS" }]);
			t = captureMachine(t.state, { type: "OPEN" });
			t = captureMachine(t.state, { type: "TEXT_CHANGED", text: "second draft" });

			// The stale completion arrives late — it must be a complete no-op.
			const beforeStale = t.state;
			t = captureMachine(t.state, { type: "SUBMIT_OK", seq: staleSeq, receipt });
			expect(t.state).toEqual(beforeStale);
			expect(t.effects).toEqual([]);
			expect(t.state.text).toBe("second draft");
		});

		it("ignores a stale SUBMIT_ERR the same way", () => {
			let t = captureMachine(initialCaptureState, { type: "OPEN" });
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
			let t = captureMachine(initialCaptureState, { type: "OPEN" });
			t = captureMachine(t.state, { type: "TEXT_CHANGED", text: "draft" });
			t = captureMachine(t.state, { type: "SUBMIT" });
			const seq = t.state.seq;

			t = captureMachine(t.state, { type: "SUBMIT_OK", seq, receipt });
			expect(t.state.status).toBe("done");
			expect(t.state.receipt).toBe(receipt);
			expect(t.state.text).toBe("");
			expect(t.effects).toEqual([{ type: "FOCUS_RECEIPT" }]);
		});
	});

	describe("offline retry race", () => {
		it("SUBMIT_ERR with offline:true sets error+offlineError, keeping text", () => {
			let t = captureMachine(initialCaptureState, { type: "OPEN" });
			t = captureMachine(t.state, { type: "TEXT_CHANGED", text: "draft" });
			t = captureMachine(t.state, { type: "SUBMIT" });
			const seq = t.state.seq;

			t = captureMachine(t.state, { type: "SUBMIT_ERR", seq, offline: true });
			expect(t.state.status).toBe("error");
			expect(t.state.offlineError).toBe(true);
			expect(t.state.receipt).toBeNull();
			expect(t.state.text).toBe("draft");
			expect(t.effects).toEqual([]);
		});

		it("ONLINE while status error && offlineError retries with a bumped seq", () => {
			let t = captureMachine(initialCaptureState, { type: "OPEN" });
			t = captureMachine(t.state, { type: "TEXT_CHANGED", text: "draft" });
			t = captureMachine(t.state, { type: "SUBMIT" });
			const seq = t.state.seq;
			t = captureMachine(t.state, { type: "SUBMIT_ERR", seq, offline: true });

			t = captureMachine(t.state, { type: "ONLINE" });
			expect(t.state.status).toBe("submitting");
			expect(t.state.seq).toBe(seq + 1);
			expect(t.effects).toEqual([{ type: "SUBMIT", text: "draft", seq: seq + 1 }]);
		});

		it("ONLINE when idle (or error without offlineError) no-ops", () => {
			const idleResult = captureMachine(initialCaptureState, { type: "ONLINE" });
			expect(idleResult.state).toEqual(initialCaptureState);
			expect(idleResult.effects).toEqual([]);

			let t = captureMachine(initialCaptureState, { type: "OPEN" });
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
			{ type: "OPEN" },
			{ type: "OPEN", prefill: "Task: " },
			{ type: "CLOSE" },
			{ type: "SUBMIT" },
			{ type: "SUBMIT_ERR", seq: 999, offline: true },
			{ type: "ONLINE" },
			{ type: "CAPTURE_ANOTHER" },
		];

		it("never clears text except on a fresh SUBMIT_OK", () => {
			// TEXT_CHANGED legitimately changes the draft's content, but no
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
				prefill: "Task: ",
			});
			expect(t.state.text).toBe("Task: ");
			expect(t.state.status).toBe("editing");
		});

		it("never overwrites an unsubmitted draft", () => {
			const t = captureMachine(
				{ ...initialCaptureState, text: "half a thought" },
				{ type: "OPEN", prefill: "Task: " },
			);
			expect(t.state.text).toBe("half a thought");
		});

		it("treats a whitespace-only draft as empty", () => {
			const t = captureMachine(
				{ ...initialCaptureState, text: "   \n " },
				{ type: "OPEN", prefill: "Note: " },
			);
			expect(t.state.text).toBe("Note: ");
		});

		it("leaves text alone when no prefill is sent", () => {
			const t = captureMachine(initialCaptureState, { type: "OPEN" });
			expect(t.state.text).toBe("");
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

		it("CLOSE bumps seq and emits RESTORE_FOCUS", () => {
			const open: CaptureState = { ...initialCaptureState, open: true, status: "editing", seq: 2 };
			const t = captureMachine(open, { type: "CLOSE" });
			expect(t.state.open).toBe(false);
			expect(t.state.status).toBe("idle");
			expect(t.state.seq).toBe(3);
			expect(t.effects).toEqual([{ type: "RESTORE_FOCUS" }]);
		});
	});
});
