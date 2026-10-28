"use client";

import { useMemo, useState, useTransition } from "react";
import type { FormState } from "@/components/ui/form-state";
import { GENERIC_FORM_ERROR } from "@/lib/action-result";
import { isNavigationError, toastFailure } from "@/lib/client/failure";
import { toastSuccess } from "@/lib/client/toast";
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
import { type Write, type WriteResult, writeSuccessMessage } from "@/lib/store/write";

export { isNavigationError };

export type SaveOpts = {
	/** A refusal with field errors hands them here and skips the toast, as useResultAction does. */
	onFieldErrors?: (state: FormState) => void;
};

export type Writes = {
	/** Apply → call → confirm + success toast | rollback + toastFailure. False: targets a provisional row, nothing applied. */
	send<K extends Kind>(w: Write<K>): boolean;
	/** Awaited. True once confirmed; failure toasts and resolves false; provisional target resolves false silently. */
	save<K extends Kind>(w: Write<K>, opts?: SaveOpts): Promise<boolean>;
	/** Awaited for useResultAction forms: returns the result untouched (success toast only); a throw rolls back and rethrows. */
	submit<K extends Kind>(w: Write<K>): Promise<WriteResult<K>>;
	/** A write made outside a server action (the upload route): apply + confirm at once, as receiveRows does. */
	adopt<K extends Kind>(kind: K, intent: IntentMap[K], written: StoreWrite<EntityMap[K]>): void;
};

/**
 * The one runner for a kind's writes (docs/adr/0077). Each method applies the
 * intent, hands the server call the ctx the store applied it with — so a call
 * that names a day names the day the user saw — then confirms or rolls back.
 * A confirm toasts the write's success copy (writeSuccessMessage); failures
 * toast through toastFailure with the write's own copy.
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
		function confirmed<K extends Kind>(w: Write<K>, token: Token, data: StoreWrite): void {
			confirm(token, data);
			const message = writeSuccessMessage(w);
			if (message) toastSuccess(message);
		}
		const provisional = <K extends Kind>(w: Write<K>) =>
			targetsProvisional(api.getState(), { kind: w.kind, intent: w.intent } as AnyIntent);

		async function save<K extends Kind>(w: Write<K>, opts: SaveOpts = {}): Promise<boolean> {
			if (provisional(w)) return false;
			const [token, ctx] = start(w);
			const fallback = w.errorMessage ?? GENERIC_FORM_ERROR;
			try {
				const result = await w.call(ctx);
				if (result.ok) {
					confirmed(w, token, result.data as StoreWrite);
					return true;
				}
				rollback(token);
				const shown = !!opts.onFieldErrors && !result.formError && !!result.fieldErrors;
				toastFailure({ result }, fallback, { fieldErrorsShown: shown });
				if (shown) opts.onFieldErrors?.({ fieldErrors: result.fieldErrors, values: result.values });
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
					if (result.ok) confirmed(w, token, result.data as StoreWrite);
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

/**
 * An inline edit form: open/close state, and a submit that closes once the
 * write confirms. With `fieldErrors: true` a refusal's field errors land in
 * `formState` for a FormStateProvider (no toast, as useResultAction); they
 * clear on the next good save, on open/close, and per field via clearField.
 */
export function useInlineEdit({ fieldErrors = false }: { fieldErrors?: boolean } = {}): {
	editing: boolean;
	pending: boolean;
	formState: FormState;
	open(): void;
	close(): void;
	clearField(name: string): void;
	/** startTransition → save(w) → close() on true. */
	submit<K extends Kind>(w: Write<K>): void;
} {
	const [editing, setEditing] = useState(false);
	const [formState, setFormState] = useState<FormState>({});
	const [pending, startTransition] = useTransition();
	const { save } = useWrites();
	return {
		editing,
		pending,
		formState,
		open: () => {
			setFormState({});
			setEditing(true);
		},
		close: () => {
			setFormState({});
			setEditing(false);
		},
		clearField(name) {
			setFormState((s) => {
				if (!s.fieldErrors?.[name]) return s;
				const { [name]: _, ...rest } = s.fieldErrors;
				return { ...s, fieldErrors: rest };
			});
		},
		submit(w) {
			startTransition(async () => {
				const ok = await save(w, fieldErrors ? { onFieldErrors: setFormState } : undefined);
				if (ok) {
					setFormState({});
					setEditing(false);
				}
			});
		},
	};
}
