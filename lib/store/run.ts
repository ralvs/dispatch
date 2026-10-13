"use client";

import { useMemo, useState, useTransition } from "react";
import { GENERIC_FORM_ERROR } from "@/lib/action-result";
import { isNavigationError, toastFailure } from "@/lib/client/failure";
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

export { isNavigationError };

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
