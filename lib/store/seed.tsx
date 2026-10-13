"use client";

import { type ReactNode, useContext, useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import { applySeed } from "@/lib/store/core";
import { SeedContext, useDispatchStore } from "@/lib/store/provider";
import type { Snapshot, Store } from "@/lib/store/types";

/**
 * Feed a server snapshot to the consumers it WRAPS.
 *
 * A store read hydrates against the fold of its ancestor Seeds' snapshots over
 * the initial state — pure, identical on server and client — whenever its
 * boundary hydrates, even after the real store has moved on. After hydrating,
 * useSyncExternalStore moves it to the real store. Until this Seed's layout
 * effect commits the snapshot (never on the server, always before paint or the
 * first click, so `apply` always finds a clock), the subtree reads the virtual
 * state folded here during render.
 */
export function Seed({ snapshot, children }: { snapshot: Snapshot; children: ReactNode }) {
	const api = useDispatchStore();
	const outer = useContext(SeedContext);
	const outerServer = outer?.server ?? api.getInitialState;
	// What the server rendered this subtree from. Folded on first read: only
	// server render and hydration read it.
	const server = useMemo(() => {
		let s: Store | undefined;
		return () => {
			s ??= applySeed(outerServer(), snapshot);
			return s;
		};
	}, [outerServer, snapshot]);
	const parent = useSyncExternalStore(
		api.subscribe,
		() => outer?.virtual ?? api.getState(),
		outerServer,
	);
	const virtual = useMemo(() => applySeed(parent, snapshot), [parent, snapshot]);
	// Once the real store holds the snapshot, the virtual state IS the real
	// state: hand the subtree the outer value (stable) so consumers fall back to
	// their own slice subscriptions instead of re-rendering on every change.
	const own = virtual === parent ? (outer?.virtual ?? null) : virtual;
	const frame = useMemo(() => ({ virtual: own, server }), [own, server]);

	useLayoutEffect(() => {
		api.getState().seed(snapshot);
	}, [api, snapshot]);

	return <SeedContext.Provider value={frame}>{children}</SeedContext.Provider>;
}
