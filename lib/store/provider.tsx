"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import type { Store } from "@/lib/store/types";

const StoreContext = createContext<DispatchStore | null>(null);

/**
 * What a `<Seed>` gives its subtree: its not-yet-committed state, and what the
 * server rendered it from. A store read hydrates against `server` — the fold
 * of its ancestor Seeds' snapshots over the initial state — so a boundary that
 * hydrates late still matches the server's markup; once hydrated,
 * useSyncExternalStore moves it to `virtual`, else the real store.
 */
export type SeedFrame = { virtual: Store | null; server: () => Store };
export const SeedContext = createContext<SeedFrame | null>(null);

/**
 * `store` is for tests that need a pre-populated store; the app lets the
 * provider build its own.
 */
export function StoreProvider({ children, store }: { children: ReactNode; store?: DispatchStore }) {
	const [api] = useState(() => store ?? createDispatchStore());
	return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useDispatchStore(): DispatchStore {
	const api = useContext(StoreContext);
	if (api === null) throw new Error("useDispatchStore must be used inside <StoreProvider>.");
	return api;
}
