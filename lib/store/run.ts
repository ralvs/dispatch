"use client";

import { unstable_rethrow } from "next/navigation";
import { useCallback } from "react";
import type { ActionResult } from "@/lib/action-result";
import { toastError } from "@/lib/client/toast";
import { targetsProvisional } from "@/lib/store/core";
import { useStoreActions } from "@/lib/store/hooks";
import { useDispatchStore } from "@/lib/store/provider";
import type { AnyIntent, EntityMap, IntentMap, Kind, StoreWrite } from "@/lib/store/types";

const DEFAULT_ERROR = "Something went wrong. Try again.";

/**
 * A Next control-flow error — redirect(), notFound(). A server action that
 * throws one rejects its promise *and* has the router navigate, so the caller
 * rolls back but must not toast a failure the user never had. unstable_rethrow
 * is the public test: it rethrows exactly these and nothing else.
 */
export function isNavigationError(error: unknown): boolean {
	try {
		unstable_rethrow(error);
		return false;
	} catch {
		return true;
	}
}

/**
 * Apply → action → confirm or rollback.
 *
 * Returns false when the intent acts on a row whose create the server has not
 * confirmed yet (`targetsProvisional`): nothing was applied, and the click is
 * swallowed until the row is real. A repeated click is not swallowed: Next
 * runs server actions one at a time, a replay finds the row already moved
 * (docs/adr/0037, completeTask's `status = open` guard), and the adapter's
 * `project` counts it once. No useTransition: the optimistic state lives in
 * the store, not in React.
 */
export function useRunIntent<K extends Kind>(
	kind: K,
	opts: { errorMessage?: string } = {},
): (
	intent: IntentMap[K],
	action: () => Promise<ActionResult<StoreWrite<EntityMap[K]>>>,
) => boolean {
	const { apply, confirm, rollback } = useStoreActions();
	const api = useDispatchStore();
	const { errorMessage = DEFAULT_ERROR } = opts;

	return useCallback(
		(intent, action) => {
			if (targetsProvisional(api.getState(), { kind, intent } as AnyIntent)) return false;
			const token = apply({ kind, intent } as AnyIntent);
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
					// Never rethrown: this promise is detached, so a rethrow reaches
					// no boundary — only an unhandled rejection. A redirect() still
					// happens: the router navigates on its own (isNavigationError).
					rollback(token);
					if (!isNavigationError(error)) toastError(errorMessage);
				}
			})();
			return true;
		},
		[kind, errorMessage, api, apply, confirm, rollback],
	);
}

/**
 * The awaited sibling of useRunIntent, for forms: apply → action → confirm or
 * rollback, and the result goes back to the caller, whose form shows its
 * field errors. No toast here — the form owns failure copy. A throw rolls
 * back and is rethrown to the form's own handler.
 */
export function useStoreWrite<K extends Kind>(
	kind: K,
): <R extends ActionResult<StoreWrite<EntityMap[K]>>>(
	intent: IntentMap[K],
	action: () => Promise<R>,
) => Promise<R> {
	const { apply, confirm, rollback } = useStoreActions();
	return useCallback(
		async (intent, action) => {
			const token = apply({ kind, intent } as AnyIntent);
			try {
				const result = await action();
				if (result.ok) confirm(token, result.data as StoreWrite);
				else rollback(token);
				return result;
			} catch (error) {
				rollback(token);
				throw error;
			}
		},
		[kind, apply, confirm, rollback],
	);
}
