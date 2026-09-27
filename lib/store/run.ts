"use client";

import { unstable_rethrow } from "next/navigation";
import { useCallback } from "react";
import type { ActionResult } from "@/lib/action-result";
import { toastError } from "@/lib/client/toast";
import { useStoreActions } from "@/lib/store/hooks";
import type { AnyIntent, EntityMap, IntentMap, Kind, StoreWrite } from "@/lib/store/types";

const DEFAULT_ERROR = "Something went wrong. Try again.";

export type IntentLockLike<I> = { claim(intent: I): boolean; release(intent: I): void };

/**
 * Claim → apply → action → confirm or rollback → release.
 *
 * Returns false when the lock refuses the claim (nothing was applied). No
 * useTransition: the optimistic state lives in the store, not in React.
 */
export function useRunIntent<K extends Kind>(
	kind: K,
	opts: { lock?: IntentLockLike<IntentMap[K]>; errorMessage?: string } = {},
): (
	intent: IntentMap[K],
	action: () => Promise<ActionResult<StoreWrite<EntityMap[K]>>>,
) => boolean {
	const { apply, confirm, rollback } = useStoreActions();
	const { lock, errorMessage = DEFAULT_ERROR } = opts;

	return useCallback(
		(intent, action) => {
			if (lock && !lock.claim(intent)) return false;
			let token: number;
			try {
				token = apply({ kind, intent } as AnyIntent);
			} catch (error) {
				lock?.release(intent);
				throw error;
			}
			void (async () => {
				try {
					const result = await action();
					if (result.ok) {
						confirm(token, result.data as StoreWrite);
					} else {
						rollback(token);
						toastError(result.formError ?? errorMessage);
					}
				} catch (error) {
					rollback(token);
					unstable_rethrow(error);
					toastError(errorMessage);
				} finally {
					lock?.release(intent);
				}
			})();
			return true;
		},
		[kind, lock, errorMessage, apply, confirm, rollback],
	);
}
