"use client";

import { useRef } from "react";
import type { TaskIntent } from "@/lib/task-interaction/apply-intent";

/**
 * Next's client serializes server actions — a rapid five-click is five
 * sequential POSTs, not five racing ones (docs/adr/0037). So a blanket
 * per-item lock buys nothing, and for the star it is actively wrong:
 * tap-star, change-mind, tap-again must both land.
 *
 * One intent is different. Completing a recurring task rolls its due date
 * forward instead of closing it, so the checkbox springs back to unchecked and
 * the second click rolls it another whole interval. That replay is destructive
 * rather than merely redundant, and it is the only one.
 */
export function isReplayUnsafe(intent: TaskIntent): boolean {
	return intent.type === "complete";
}

function keyOf(intent: TaskIntent): string {
	return `${intent.type}:${intent.type === "create" ? intent.task.id : intent.id}`;
}

/** Pure core of the lock, so the contract is testable without React. */
export function createIntentLock(held: Set<string> = new Set()) {
	return {
		/** False only when this exact replay-unsafe intent is already in flight. */
		claim(intent: TaskIntent): boolean {
			if (!isReplayUnsafe(intent)) return true;
			const key = keyOf(intent);
			if (held.has(key)) return false;
			held.add(key);
			return true;
		},
		release(intent: TaskIntent): void {
			held.delete(keyOf(intent));
		},
	};
}

/**
 * A claim costs zero renders — the Set lives in a ref on purpose. A swallowed
 * click on a control whose optimistic state already shows the new value is
 * indistinguishable from one that landed, so there is nothing to re-render and
 * no `disabled` to set.
 */
export function useIntentLock() {
	const ref = useRef<ReturnType<typeof createIntentLock> | null>(null);
	if (ref.current === null) ref.current = createIntentLock();
	return ref.current;
}
