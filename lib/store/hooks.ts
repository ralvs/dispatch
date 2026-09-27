"use client";

import { useContext, useMemo } from "react";
import { useStore } from "zustand";
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
 * The state this subtree reads: the nearest `<Seed>`'s virtual state, else the
 * real store. The whole-state subscription returns a stable reference between
 * changes; derived values are memoized on it, so selectors stay pure and never
 * hand useSyncExternalStore a fresh object.
 */
function useStoreState(): Store {
	const real = useStore(useDispatchStore());
	return useContext(VirtualStateContext) ?? real;
}

export function useView<T extends ViewType>(key: ViewKey<T>): ViewTypes[T]["out"] | undefined {
	const state = useStoreState();
	return useMemo(() => selectView(state, key), [state, key]);
}

export function useAggregate(key: AggregateKey): number | undefined {
	const state = useStoreState();
	return useMemo(() => selectAggregate(state, key), [state, key]);
}

/** Throws when no snapshot has reached this subtree: the consumer sits outside any Seed. */
export function useClock(): Clock {
	const clock = useStoreState().clock;
	const todayIso = clock?.todayIso;
	const tz = clock?.tz;
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
