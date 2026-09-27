import { createStore, type StoreApi } from "zustand/vanilla";
import { nowUtc } from "@/lib/dates";
import { type Core, core as defaultCore } from "@/lib/store/core";
import type { Instant, Store } from "@/lib/store/types";

export type DispatchStore = StoreApi<Store>;

/**
 * One store per request / tab — build it in a provider, never as a module
 * singleton. `now` is called only inside `apply`, i.e. at event-handler time,
 * never during render.
 */
export function createDispatchStore(
	opts: { now?: () => Instant; core?: Core } = {},
): DispatchStore {
	const now = opts.now ?? (() => nowUtc());
	const core = opts.core ?? defaultCore;
	return createStore<Store>()((set, get) => ({
		...core.initialState(),
		seed: (snap) => set((s) => core.applySeed(s, snap)),
		apply: (i) => {
			const [next, token] = core.applyIntent(get(), i, now());
			set(next);
			return token;
		},
		confirm: (token, write) => set((s) => core.confirmWrite(s, token, write)),
		rollback: (token) => set((s) => core.rollbackWrite(s, token)),
	}));
}
