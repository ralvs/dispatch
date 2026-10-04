// A write: one intent and the server call that confirms it, built together
// from the same arguments by the kind's writes module (docs/adr/0077).
// Client-safe — no React.

import type { ActionResult } from "@/lib/action-result";
import type { EntityMap, IntentCtx, IntentMap, Kind, StoreWrite } from "@/lib/store/types";

export type WriteResult<K extends Kind> = ActionResult<StoreWrite<EntityMap[K]>>;

export type Write<K extends Kind> = {
	readonly kind: K;
	readonly intent: IntentMap[K];
	/** Server half. `ctx` is the ctx the store applied `intent` with; a day goes from `intent` or `ctx.todayIso`. */
	readonly call: (ctx: IntentCtx) => Promise<WriteResult<K>>;
	/** Toast copy on failure. Default GENERIC_FORM_ERROR. */
	readonly errorMessage?: string;
};

export function write<K extends Kind>(
	kind: K,
	intent: IntentMap[K],
	call: Write<K>["call"],
	errorMessage?: string,
): Write<K> {
	return { kind, intent, call, errorMessage };
}
