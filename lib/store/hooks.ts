"use client";

import { useContext, useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { selectAggregate, selectView } from "@/lib/store/core";
import { useDispatchStore, VirtualStateContext } from "@/lib/store/provider";
import type {
	AggregateKey,
	Clock,
	Store,
	StoreActions,
	ViewKey,
	ViewType,
	ViewTypes,
} from "@/lib/store/types";

/**
 * Read a slice of the state this subtree sees: the nearest `<Seed>`'s virtual
 * state, else the real store. The real store is subscribed through `select`
 * (shallow-compared), so a consumer re-renders only when its slice changes.
 */
function useSlice<T>(select: (s: Store) => T): T {
	const virtual = useContext(VirtualStateContext);
	const real = useStore(useDispatchStore(), useShallow(select));
	return virtual ? select(virtual) : real;
}

export function useView<T extends ViewType>(key: ViewKey<T>): ViewTypes[T]["out"] | undefined {
	const [entry, rows, pending, clock] = useSlice(
		(s) => [s.views[key], s.rows, s.pending, s.clock] as const,
	);
	return useMemo(
		() => selectView({ views: { [key]: entry }, rows, pending, clock } as Store, key),
		[key, entry, rows, pending, clock],
	);
}

export function useAggregate(key: AggregateKey): number | undefined {
	// A primitive: an unrelated apply leaves it equal, so nothing re-renders.
	return useSlice((s) => selectAggregate(s, key));
}

/** Throws when no snapshot has reached this subtree: the consumer sits outside any Seed. */
export function useClock(): Clock {
	const [todayIso, tz] = useSlice((s) => [s.clock?.todayIso, s.clock?.tz] as const);
	const value = useMemo(
		() => (todayIso !== undefined && tz !== undefined ? { todayIso, tz } : null),
		[todayIso, tz],
	);
	if (value === null) throw new Error("useClock ran outside any <Seed>.");
	return value;
}

export function useStoreActions(): StoreActions {
	const api = useDispatchStore();
	return useMemo(() => {
		const { seed, apply, confirm, rollback } = api.getState();
		return { seed, apply, confirm, rollback };
	}, [api]);
}
