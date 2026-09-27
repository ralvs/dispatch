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
	return createStore<Store>()((set) => ({
		...core.initialState(),
		seed: (snap) => set((s) => core.applySeed(s, snap)),
		apply: (i) => {
			// Read the time first: nothing may run between reading the state and
			// writing it back, or a seed landing there would be lost.
			const at = now();
			let token = 0;
			set((s) => {
				const [next, t] = core.applyIntent(s, i, at);
				token = t;
				return next;
			});
			return token;
		},
		confirm: (token, write) => set((s) => core.confirmWrite(s, token, write)),
		rollback: (token) => set((s) => core.rollbackWrite(s, token)),
	}));
}
