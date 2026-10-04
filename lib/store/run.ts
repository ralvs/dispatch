"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { type ActionResult, GENERIC_FORM_ERROR } from "@/lib/action-result";
import { isNavigationError, toastFailure } from "@/lib/client/failure";
import { toastError } from "@/lib/client/toast";
import { targetsProvisional } from "@/lib/store/core";
import { useStoreActions } from "@/lib/store/hooks";
import { useDispatchStore } from "@/lib/store/provider";
import type {
	AnyIntent,
	EntityMap,
	IntentCtx,
	IntentMap,
	Kind,
	StoreWrite,
	Token,
} from "@/lib/store/types";
import type { Write, WriteResult } from "@/lib/store/write";

const DEFAULT_ERROR = "Something went wrong. Try again.";

export { isNavigationError };

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

export type Writes = {
	/** Apply → call → confirm | rollback + toastFailure. False: targets a provisional row, nothing applied. */
	send<K extends Kind>(w: Write<K>): boolean;
	/** Awaited. True once confirmed; failure toasts and resolves false; provisional target resolves false silently. */
	save<K extends Kind>(w: Write<K>): Promise<boolean>;
	/** Awaited for useResultAction forms: returns the result untouched (no toast); a throw rolls back and rethrows. */
	submit<K extends Kind>(w: Write<K>): Promise<WriteResult<K>>;
	/** A write made outside a server action (the upload route): apply + confirm at once, as receiveRows does. */
	adopt<K extends Kind>(kind: K, intent: IntentMap[K], written: StoreWrite<EntityMap[K]>): void;
};

/**
 * The one runner for a kind's writes (docs/adr/0077). Each method applies the
 * intent, hands the server call the ctx the store applied it with — so a call
 * that names a day names the day the user saw — then confirms or rolls back.
 * Failures toast through toastFailure with the write's own copy.
 */
export function useWrites(): Writes {
	const { apply, confirm, rollback } = useStoreActions();
	const api = useDispatchStore();

	return useMemo(() => {
		function start<K extends Kind>(w: Write<K>): [Token, IntentCtx] {
			const token = apply({ kind: w.kind, intent: w.intent } as AnyIntent);
			// biome-ignore lint/style/noNonNullAssertion: apply() just pushed this token.
			const ctx = api.getState().pending.find((p) => p.token === token)!.ctx;
			return [token, ctx];
		}
		const provisional = <K extends Kind>(w: Write<K>) =>
			targetsProvisional(api.getState(), { kind: w.kind, intent: w.intent } as AnyIntent);

		async function save<K extends Kind>(w: Write<K>): Promise<boolean> {
			if (provisional(w)) return false;
			const [token, ctx] = start(w);
			const fallback = w.errorMessage ?? GENERIC_FORM_ERROR;
			try {
				const result = await w.call(ctx);
				if (result.ok) {
					confirm(token, result.data as StoreWrite);
					return true;
				}
				rollback(token);
				toastFailure({ result }, fallback);
				return false;
			} catch (error) {
				rollback(token);
				toastFailure({ thrown: error }, fallback);
				return false;
			}
		}

		return {
			send(w) {
				if (provisional(w)) return false;
				// Never rejects: save() catches, so the detached promise reaches no
				// unhandled rejection. A redirect() still navigates on its own.
				void save(w);
				return true;
			},
			save,
			async submit(w) {
				const [token, ctx] = start(w);
				try {
					const result = await w.call(ctx);
					if (result.ok) confirm(token, result.data as StoreWrite);
					else rollback(token);
					return result;
				} catch (error) {
					rollback(token);
					throw error;
				}
			},
			adopt(kind, intent, written) {
				const token = apply({ kind, intent } as AnyIntent);
				confirm(token, written as StoreWrite);
			},
		};
	}, [api, apply, confirm, rollback]);
}

/** An inline edit form: open/close state, and a submit that closes once the write confirms. */
export function useInlineEdit(): {
	editing: boolean;
	pending: boolean;
	open(): void;
	close(): void;
	/** startTransition → save(w) → close() on true. */
	submit<K extends Kind>(w: Write<K>): void;
} {
	const [editing, setEditing] = useState(false);
	const [pending, startTransition] = useTransition();
	const { save } = useWrites();
	return {
		editing,
		pending,
		open: () => setEditing(true),
		close: () => setEditing(false),
		submit(w) {
			startTransition(async () => {
				if (await save(w)) setEditing(false);
			});
		},
	};
}
