"use client";

import { type ReactNode, useContext, useLayoutEffect, useMemo } from "react";
import { useStore } from "zustand";
import { applySeed } from "@/lib/store/core";
import { useDispatchStore, VirtualStateContext } from "@/lib/store/provider";
import type { Snapshot } from "@/lib/store/types";

/**
 * Feed a server snapshot to the consumers it WRAPS.
 *
 * zustand's `useStore` hands `getInitialState` to useSyncExternalStore as the
 * server snapshot, so while hydrating every selector sees the initial state —
 * a seed written during render would be invisible and the markup would
 * mismatch. So the snapshot is folded into a virtual state here, during render
 * (pure, identical on server and client), and provided to the subtree. The
 * real store takes it in a layout effect: never on the server, always before
 * paint or the first click, so `apply` always finds a clock.
 */
export function Seed({ snapshot, children }: { snapshot: Snapshot; children: ReactNode }) {
	const api = useDispatchStore();
	const real = useStore(api);
	const outer = useContext(VirtualStateContext);
	const parent = outer ?? real;
	const virtual = useMemo(() => applySeed(parent, snapshot), [parent, snapshot]);
	// Once the real store holds the snapshot, the virtual state IS the real
	// state: hand the subtree the outer value (stable) so consumers fall back to
	// their own slice subscriptions instead of re-rendering on every change.
	const provided = virtual === parent ? outer : virtual;

	useLayoutEffect(() => {
		api.getState().seed(snapshot);
	}, [api, snapshot]);

	return <VirtualStateContext.Provider value={provided}>{children}</VirtualStateContext.Provider>;
}
