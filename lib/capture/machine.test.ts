import { describe, expect, it } from "vitest";
import {
	type CaptureEvent,
	type CaptureState,
	captureMachine,
	hasPendingSlips,
	initialCaptureState,
	RECORDING_RECEIPT,
} from "@/lib/capture/machine";
import type { CaptureReceipt } from "@/lib/capture/receipt";

const RECEIPT: CaptureReceipt = { tone: "executed", title: "Captured", lines: ["1 task added."] };
const REVIEW: CaptureReceipt = { tone: "needs_review", title: "Kept for review", lines: ["…"] };

/** Fold a script of events, returning the final state and the last effects. */
function run(events: CaptureEvent[], from: CaptureState = initialCaptureState) {
	let state = from;
	let effects: ReturnType<typeof captureMachine>["effects"] = [];
	for (const event of events) {
		const result = captureMachine(state, event);
		state = result.state;
		effects = result.effects;
	}
	return { state, effects };
}

const type = (text: string): CaptureEvent => ({ type: "TEXT_CHANGED", text });

describe("captureMachine", () => {
	describe("concurrent slips — capture several in a row", () => {
		it("clears the composer on submit and keeps the palette open", () => {
			const { state, effects } = run([{ type: "OPEN" }, type("buy milk"), { type: "SUBMIT" }]);

			expect(state.open).toBe(true);
			expect(state.text).toBe("");
			expect(state.slips).toHaveLength(1);
			expect(state.slips[0]).toMatchObject({ id: 1, text: "buy milk", status: "submitting" });
			expect(effects).toEqual([
				{ type: "SUBMIT", text: "buy milk", id: 1 },
				{ type: "FOCUS_TEXTAREA" },
			]);
		});

		it("accepts a second submit while the first is still in flight", () => {
			const { state } = run([
				{ type: "OPEN" },
				type("one"),
				{ type: "SUBMIT" },
				type("two"),
				{ type: "SUBMIT" },
				type("three"),
				{ type: "SUBMIT" },
			]);

			expect(state.slips.map((s) => [s.id, s.text, s.status])).toEqual([
				[1, "one", "submitting"],
				[2, "two", "submitting"],
				[3, "three", "submitting"],
			]);
			expect(hasPendingSlips(state)).toBe(true);
		});

		it("settles each slip independently, out of order", () => {
			const { state } = run([
				{ type: "OPEN" },
				type("one"),
				{ type: "SUBMIT" },
				type("two"),
				{ type: "SUBMIT" },
				// The second capture comes back first.
				{ type: "SUBMIT_OK", id: 2, receipt: REVIEW },
				{ type: "SUBMIT_OK", id: 1, receipt: RECEIPT },
			]);

			expect(state.slips.map((s) => [s.id, s.status, s.receipt?.title])).toEqual([
				[1, "done", "Captured"],
				[2, "done", "Kept for review"],
			]);
			expect(hasPendingSlips(state)).toBe(false);
		});

		it("shows the provisional receipt until a slip settles", () => {
			const { state } = run([{ type: "OPEN" }, type("hmm"), { type: "SUBMIT" }]);
			expect(state.slips[0].receipt).toEqual(RECORDING_RECEIPT);
		});

		it("a reply for an unknown slip changes nothing", () => {
			const before = run([{ type: "OPEN" }, type("one"), { type: "SUBMIT" }]).state;
			const after = captureMachine(before, { type: "SUBMIT_OK", id: 99, receipt: RECEIPT });
			expect(after.state.slips).toEqual(before.slips);
			expect(after.effects).toEqual([]);
		});
	});

	describe("closing mid-flight never loses or duplicates a capture", () => {
		// The regression this whole redesign exists for. The old machine bumped a
		// global seq on CLOSE, which discarded the reply AND left the submitted
		// text sitting in the composer — so reopening showed words that had in
		// fact already been captured, and submitting them again duplicated them.
		it("does not leave the submitted text in the composer", () => {
			const { state } = run([
				{ type: "OPEN" },
				type("buy milk"),
				{ type: "SUBMIT" },
				{ type: "CLOSE" },
				{ type: "OPEN" },
			]);

			expect(state.text).toBe("");
		});

		it("toasts and drops a slip that settles while the palette is closed", () => {
			const { state, effects } = run([
				{ type: "OPEN" },
				type("buy milk"),
				{ type: "SUBMIT" },
				{ type: "CLOSE" },
				{ type: "SUBMIT_OK", id: 1, receipt: RECEIPT },
			]);

			expect(state.slips).toEqual([]);
			expect(effects).toEqual([{ type: "TOAST", kind: "ok", receipt: RECEIPT, text: "buy milk" }]);
		});

		it("toasts a failure that lands while closed, and keeps the words for retry", () => {
			const { state, effects } = run([
				{ type: "OPEN" },
				type("buy milk"),
				{ type: "SUBMIT" },
				{ type: "CLOSE" },
				{ type: "SUBMIT_ERR", id: 1, offline: false },
			]);

			expect(state.slips[0]).toMatchObject({ text: "buy milk", status: "error" });
			expect(effects).toEqual([{ type: "TOAST", kind: "err", offline: false, text: "buy milk" }]);
		});

		it("does not toast a slip that settles while the palette is still open", () => {
			const { effects } = run([
				{ type: "OPEN" },
				type("buy milk"),
				{ type: "SUBMIT" },
				{ type: "SUBMIT_OK", id: 1, receipt: RECEIPT },
			]);
			expect(effects).toEqual([]);
		});

		it("keeps an in-flight slip visible on reopen, and drops seen ones", () => {
			const { state } = run([
				{ type: "OPEN" },
				type("settled"),
				{ type: "SUBMIT" },
				type("still going"),
				{ type: "SUBMIT" },
				{ type: "SUBMIT_OK", id: 1, receipt: RECEIPT },
				{ type: "CLOSE" },
				{ type: "OPEN" },
			]);

			expect(state.slips.map((s) => s.text)).toEqual(["still going"]);
		});

		it("keeps a failed slip across a close, so its words survive", () => {
			const { state } = run([
				{ type: "OPEN" },
				type("buy milk"),
				{ type: "SUBMIT" },
				{ type: "SUBMIT_ERR", id: 1, offline: false },
				{ type: "CLOSE" },
				{ type: "OPEN" },
			]);

			expect(state.slips[0]).toMatchObject({ text: "buy milk", status: "error" });
		});

		it("CLOSE emits RESTORE_FOCUS", () => {
			const { effects } = run([{ type: "OPEN" }, { type: "CLOSE" }]);
			expect(effects).toEqual([{ type: "RESTORE_FOCUS" }]);
		});
	});

	describe("failure and retry", () => {
		it("SUBMIT_ERR marks only its own slip and drops its provisional receipt", () => {
			const { state } = run([
				{ type: "OPEN" },
				type("one"),
				{ type: "SUBMIT" },
				type("two"),
				{ type: "SUBMIT" },
				{ type: "SUBMIT_ERR", id: 1, offline: true },
			]);

			expect(state.slips[0]).toMatchObject({ status: "error", offline: true, receipt: null });
			expect(state.slips[1]).toMatchObject({ status: "submitting" });
		});

		it("RETRY resubmits the failed slip's text under a new id", () => {
			const { state, effects } = run([
				{ type: "OPEN" },
				type("buy milk"),
				{ type: "SUBMIT" },
				{ type: "SUBMIT_ERR", id: 1, offline: false },
				{ type: "RETRY", id: 1 },
			]);

			expect(state.slips).toHaveLength(1);
			expect(state.slips[0]).toMatchObject({ id: 2, text: "buy milk", status: "submitting" });
			expect(effects).toEqual([{ type: "SUBMIT", text: "buy milk", id: 2 }]);
		});

		it("RETRY on a slip that is not failed is a no-op", () => {
			const before = run([{ type: "OPEN" }, type("one"), { type: "SUBMIT" }]).state;
			const { state, effects } = run([{ type: "RETRY", id: 1 }], before);
			expect(state).toEqual(before);
			expect(effects).toEqual([]);
		});

		it("ONLINE retries every offline failure and leaves other failures alone", () => {
			const { state, effects } = run([
				{ type: "OPEN" },
				type("offline one"),
				{ type: "SUBMIT" },
				type("server error"),
				{ type: "SUBMIT" },
				type("offline two"),
				{ type: "SUBMIT" },
				{ type: "SUBMIT_ERR", id: 1, offline: true },
				{ type: "SUBMIT_ERR", id: 2, offline: false },
				{ type: "SUBMIT_ERR", id: 3, offline: true },
				{ type: "ONLINE" },
			]);

			expect(state.slips.map((s) => [s.text, s.status])).toEqual([
				["server error", "error"],
				["offline one", "submitting"],
				["offline two", "submitting"],
			]);
			expect(effects).toEqual([
				{ type: "SUBMIT", text: "offline one", id: 4 },
				{ type: "SUBMIT", text: "offline two", id: 5 },
			]);
		});

		it("ONLINE with nothing stranded is a no-op", () => {
			const before = run([{ type: "OPEN" }, type("one"), { type: "SUBMIT" }]).state;
			const { state, effects } = run([{ type: "ONLINE" }], before);
			expect(state).toEqual(before);
			expect(effects).toEqual([]);
		});
	});

	describe("never-lose invariant", () => {
		// Every event, applied to a state holding one in-flight and one failed
		// slip: the words behind both must still be reachable afterwards.
		const seeded = run([
			{ type: "OPEN" },
			type("failed words"),
			{ type: "SUBMIT" },
			{ type: "SUBMIT_ERR", id: 1, offline: false },
			type("pending words"),
			{ type: "SUBMIT" },
		]).state;

		const events: CaptureEvent[] = [
			{ type: "OPEN" },
			{ type: "OPEN", prefill: "a chip" },
			{ type: "CLOSE" },
			{ type: "TEXT_CHANGED", text: "typing" },
			{ type: "SUBMIT" },
			{ type: "SUBMIT_OK", id: 2, receipt: RECEIPT },
			{ type: "SUBMIT_ERR", id: 2, offline: true },
			{ type: "ONLINE" },
			{ type: "RETRY", id: 1 },
			{ type: "DISMISS", id: 1 },
			{ type: "DISMISS", id: 2 },
		];

		for (const event of events) {
			it(`${event.type} keeps unsettled words reachable`, () => {
				const { state } = run([event], seeded);
				const carried = [state.text, ...state.slips.map((s) => s.text)];
				expect(carried).toContain("failed words");
				expect(carried).toContain("pending words");
			});
		}

		it("DISMISS removes a settled slip and nothing else", () => {
			const { state } = run([
				{ type: "OPEN" },
				type("one"),
				{ type: "SUBMIT" },
				{ type: "SUBMIT_OK", id: 1, receipt: RECEIPT },
				{ type: "DISMISS", id: 1 },
			]);
			expect(state.slips).toEqual([]);
		});

		it("DISMISS refuses to drop an in-flight slip", () => {
			const before = run([{ type: "OPEN" }, type("one"), { type: "SUBMIT" }]).state;
			const { state } = run([{ type: "DISMISS", id: 1 }], before);
			expect(state.slips).toHaveLength(1);
		});
	});

	describe("OPEN prefill (Today's capture chips)", () => {
		it("seeds an empty composer with the chip's hint", () => {
			const { state } = run([{ type: "OPEN", prefill: "Journal: " }]);
			expect(state.text).toBe("Journal: ");
		});

		it("never overwrites an unsubmitted draft", () => {
			const { state } = run([
				{ type: "OPEN" },
				type("half a thought"),
				{ type: "CLOSE" },
				{ type: "OPEN", prefill: "Journal: " },
			]);
			expect(state.text).toBe("half a thought");
		});

		it("treats a whitespace-only draft as empty", () => {
			const { state } = run([{ type: "OPEN" }, type("   "), { type: "OPEN", prefill: "Quote: " }]);
			expect(state.text).toBe("Quote: ");
		});

		it("leaves text alone when no prefill is sent", () => {
			const { state } = run([{ type: "OPEN" }, type("draft"), { type: "OPEN" }]);
			expect(state.text).toBe("draft");
		});
	});

	describe("misc transitions", () => {
		it("SUBMIT on a blank draft is a no-op", () => {
			const { state, effects } = run([{ type: "OPEN" }, type("   "), { type: "SUBMIT" }]);
			expect(state.slips).toEqual([]);
			expect(effects).toEqual([]);
		});

		it("hasPendingSlips is false once everything settles", () => {
			const { state } = run([
				{ type: "OPEN" },
				type("one"),
				{ type: "SUBMIT" },
				{ type: "SUBMIT_ERR", id: 1, offline: false },
			]);
			expect(hasPendingSlips(state)).toBe(false);
		});
	});
});
