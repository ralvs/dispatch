import { describe, expect, it } from "vitest";
import type { TaskIntent } from "@/lib/task-interaction/apply-intent";
import { createIntentLock, isReplayUnsafe } from "@/lib/task-interaction/intent-lock";

const complete = (id: string): TaskIntent => ({ type: "complete", id });

describe("isReplayUnsafe", () => {
	// Completing a recurring task rolls the due date instead of closing it, so
	// a repeat click advances another interval. Nothing else in the vocabulary
	// does damage on replay: reopen and delete are idempotent, and the star has
	// to allow a rapid re-tap.
	it("singles out complete", () => {
		expect(isReplayUnsafe(complete("t1"))).toBe(true);
		expect(isReplayUnsafe({ type: "reopen", id: "t1" })).toBe(false);
		expect(isReplayUnsafe({ type: "toggleTop3", id: "t1" })).toBe(false);
		expect(isReplayUnsafe({ type: "delete", id: "t1" })).toBe(false);
	});
});

describe("createIntentLock", () => {
	it("refuses a second complete for the same task while one is in flight", () => {
		const lock = createIntentLock();

		expect(lock.claim(complete("t1"))).toBe(true);
		expect(lock.claim(complete("t1"))).toBe(false);
		expect(lock.claim(complete("t1"))).toBe(false);
	});

	it("locks per task, not globally", () => {
		const lock = createIntentLock();

		expect(lock.claim(complete("t1"))).toBe(true);
		expect(lock.claim(complete("t2"))).toBe(true);
	});

	it("reopens the task once the intent is released", () => {
		const lock = createIntentLock();

		lock.claim(complete("t1"));
		lock.release(complete("t1"));

		expect(lock.claim(complete("t1"))).toBe(true);
	});

	// Star, unstar, star again in quick succession all have to land — the lock
	// exists for the destructive replay, not for click volume.
	it("never refuses a star, however fast it repeats", () => {
		const lock = createIntentLock();
		const star: TaskIntent = { type: "toggleTop3", id: "t1" };

		expect([lock.claim(star), lock.claim(star), lock.claim(star)]).toEqual([true, true, true]);
	});

	it("does not let a complete lock block a reopen of the same task", () => {
		const lock = createIntentLock();

		lock.claim(complete("t1"));

		expect(lock.claim({ type: "reopen", id: "t1" })).toBe(true);
	});
});
