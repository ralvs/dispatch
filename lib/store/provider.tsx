"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import type { Store } from "@/lib/store/types";

const StoreContext = createContext<DispatchStore | null>(null);

/**
 * The state a `<Seed>` computes for its subtree during render, before its
 * layout effect commits the snapshot into the real store. Hooks prefer it, so
 * server render and hydration read the same thing (no React #418).
 */
export const VirtualStateContext = createContext<Store | null>(null);

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
