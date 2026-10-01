// Pure transitions and selectors for the entity store (#25). No React, no
// zustand. Every transition returns a new state (never mutates its input) and
// returns the SAME reference when it changes nothing. The conflict rule is in
// ./types.ts.

import { noteKind, noteListsView } from "@/lib/store/kinds/note";
import { notificationKind, notificationListView } from "@/lib/store/kinds/notification";
import { routineKind, routineListView } from "@/lib/store/kinds/routine";
import { dayView, taskKind, taskListsView, taskListView } from "@/lib/store/kinds/task";
import type {
	Adapters,
	AggregateKey,
	AnyIntent,
	Clock,
	Confirmed,
	Deltas,
	Instant,
	IntentCtx,
	Kind,
	Pending,
	RowEntry,
	Snapshot,
	StoreState,
	StoreWrite,
	Token,
	ViewEntry,
	ViewKey,
	ViewType,
	ViewTypes,
} from "@/lib/store/types";

/** Confirmed writes kept for replay onto stale seeds; oldest dropped. */
export const CONFIRMED_CAP = 500;

export const defaultAdapters: Adapters = {
	kinds: { task: taskKind, notification: notificationKind, routine: routineKind, note: noteKind },
	views: {
		taskLists: taskListsView,
		taskList: taskListView,
		day: dayView,
		notificationList: notificationListView,
		routineList: routineListView,
		noteLists: noteListsView,
	},
};

// The adapters are typed per view; inside the core every view is handled
// through the same shape, so one loose alias keeps the generic code readable.
type LooseView = {
	kind: Kind;
	fromSeed(data: unknown): { base: unknown; params: unknown };
	rowsOf(view: unknown): unknown[];
	reduce(view: unknown, intent: unknown, ctx: IntentCtx, params: unknown): unknown;
	upsert(view: unknown, rows: unknown[], clock: Clock, params: unknown): unknown;
	remove(view: unknown, ids: ReadonlySet<string>, clock: Clock): unknown;
	patch(view: unknown, rowOf: (id: string) => RowEntry<unknown> | undefined, clock: Clock): unknown;
};
type LooseKind = {
	idOf(row: unknown): string;
	targetId(intent: unknown): string | undefined;
	provisionalIds(intent: unknown): string[];
	project?(row: unknown, intent: unknown): unknown;
	deltas?(
		intent: unknown,
		before: unknown,
		ctx: IntentCtx,
		current: (key: AggregateKey) => number | undefined,
	): Deltas;
	settle?(intent: unknown, write: StoreWrite, deltas: Deltas): Deltas;
};
type LooseRows = Record<string, Record<string, RowEntry<unknown>>>;

/** Strictly later, compared as instants ("Z" and "+00:00" sort alike). */
function later(a: Instant, b: Instant): boolean {
	return Date.parse(a) > Date.parse(b);
}

export function initialState(): StoreState {
	return {
		clock: null,
		rows: { task: {}, notification: {}, routine: {}, note: {} },
		views: {},
		aggregates: {},
		pending: [],
		confirmed: [],
		nextToken: 1,
	};
}

export function makeCore(adapters: Adapters) {
	const viewOf = (type: ViewType) => adapters.views[type] as unknown as LooseView;
	const kindOf = (kind: Kind) => adapters.kinds[kind] as unknown as LooseKind;

	/** Fold one confirmed write into a view: reduce, drop provisional + deleted ids, upsert. */
	function commit(entry: ViewEntry, c: Confirmed, clock: Clock): unknown {
		const view = viewOf(entry.type);
		const reduced = view.reduce(entry.base, c.intent, c.ctx, entry.params);
		const gone = new Set([
			...kindOf(c.kind).provisionalIds(c.intent),
			...(c.write.deletedIds ?? []),
		]);
		const removed = gone.size > 0 ? view.remove(reduced, gone, clock) : reduced;
		return view.upsert(removed, c.write.rows, clock, entry.params);
	}

	/** Write rows into the normalized table at version `v` where `v` is newer. */
	function upsertRows(
		rows: LooseRows,
		kind: Kind,
		list: unknown[],
		deletedIds: string[],
		v: Instant,
	): LooseRows {
		const idOf = kindOf(kind).idOf;
		let table = rows[kind] ?? {};
		const start = table;
		const put = (id: string, entry: RowEntry<unknown>) => {
			const prev = table[id];
			if (prev && !later(v, prev.v)) return;
			if (table === start) table = { ...start };
			table[id] = entry;
		};
		for (const row of list) put(idOf(row), { row, v });
		for (const id of deletedIds) put(id, { deleted: true, v });
		return table === start ? rows : { ...rows, [kind]: table };
	}

	function applySeed<S extends StoreState>(s: S, snap: Snapshot): S {
		const { readAt } = snap;
		let clock = s.clock;
		if (clock === null || later(readAt, clock.readAt)) {
			clock = { todayIso: snap.todayIso, tz: snap.tz, readAt };
		}
		const newer = s.confirmed.filter((c) => later(c.write.at, readAt));
		let rows = s.rows as unknown as LooseRows;
		let views = s.views;

		for (const seed of snap.views ?? []) {
			const view = viewOf(seed.type);
			const { base, params } = view.fromSeed(seed.data);
			rows = upsertRows(rows, view.kind, view.rowsOf(base), [], readAt);
			const prev = views[seed.key];
			if (prev && !later(readAt, prev.readAt)) continue;
			let entry = { type: seed.type, base, params, readAt } as ViewEntry;
			for (const c of newer) {
				if (c.kind !== view.kind) continue;
				entry = { ...entry, base: commit(entry, c, snap) } as ViewEntry;
			}
			views = { ...views, [seed.key]: entry };
		}

		let aggregates = s.aggregates;
		for (const [key, value] of Object.entries(snap.aggregates ?? {}) as [AggregateKey, number][]) {
			const prev = aggregates[key];
			if (prev && !later(readAt, prev.readAt)) continue;
			const replay = newer.reduce((sum, c) => sum + (c.deltas[key] ?? 0), 0);
			aggregates = { ...aggregates, [key]: { value: value + replay, readAt } };
		}

		if (
			clock === s.clock &&
			rows === (s.rows as unknown) &&
			views === s.views &&
			aggregates === s.aggregates
		) {
			return s;
		}
		return { ...s, clock, rows: rows as unknown as StoreState["rows"], views, aggregates };
	}

	/** Push an optimistic intent. `nowIso` is taken by the caller at event time. */
	function applyIntent<S extends StoreState>(s: S, i: AnyIntent, nowIso: Instant): [S, Token] {
		if (s.clock === null) {
			throw new Error("Store has no clock: apply() ran outside any <Seed>.");
		}
		const ctx: IntentCtx = { todayIso: s.clock.todayIso, tz: s.clock.tz, nowIso };
		const kind = kindOf(i.kind);
		const id = kind.targetId(i.intent);
		const entry = id === undefined ? undefined : (s.rows as unknown as LooseRows)[i.kind]?.[id];
		let before = entry && !("deleted" in entry) ? entry.row : undefined;
		if (kind.project && before !== undefined) {
			for (const p of s.pending) if (p.kind === i.kind) before = kind.project(before, p.intent);
		}
		const deltas = kind.deltas
			? kind.deltas(i.intent, before, ctx, (key) => selectAggregate(s, key))
			: {};
		const token = s.nextToken;
		const pending = { ...i, token, ctx, deltas } as Pending;
		return [{ ...s, pending: [...s.pending, pending], nextToken: token + 1 }, token];
	}

	function confirmWrite<S extends StoreState>(s: S, token: Token, write: StoreWrite): S {
		const p = s.pending.find((x) => x.token === token);
		if (!p) return s;
		// The server's answer can say the intent did not happen; its deltas go
		// with it, here and on every later replay.
		const settle = kindOf(p.kind).settle;
		const deltas = settle ? settle(p.intent, write, p.deltas) : p.deltas;
		const c = { ...p, deltas, write } as Confirmed;
		const clock: Clock = s.clock ?? p.ctx;

		let views = s.views;
		for (const [key, entry] of Object.entries(s.views)) {
			if (viewOf(entry.type).kind !== c.kind || !later(write.at, entry.readAt)) continue;
			views = { ...views, [key]: { ...entry, base: commit(entry, c, clock) } as ViewEntry };
		}

		const rows = upsertRows(
			s.rows as unknown as LooseRows,
			c.kind,
			write.rows,
			write.deletedIds ?? [],
			write.at,
		);

		let aggregates = s.aggregates;
		for (const [key, d] of Object.entries(c.deltas) as [AggregateKey, number][]) {
			const prev = aggregates[key];
			if (!prev || !later(write.at, prev.readAt)) continue;
			aggregates = { ...aggregates, [key]: { ...prev, value: prev.value + d } };
		}

		const confirmed = [...s.confirmed, c];
		return {
			...s,
			views,
			rows: rows as unknown as StoreState["rows"],
			aggregates,
			pending: s.pending.filter((x) => x.token !== token),
			confirmed: confirmed.length > CONFIRMED_CAP ? confirmed.slice(-CONFIRMED_CAP) : confirmed,
		};
	}

	function rollbackWrite<S extends StoreState>(s: S, token: Token): S {
		if (!s.pending.some((x) => x.token === token)) return s;
		return { ...s, pending: s.pending.filter((x) => x.token !== token) };
	}

	/** Base, patched with the freshest rows, with pending intents folded on top. */
	function selectView<T extends ViewType>(
		s: StoreState,
		key: ViewKey<T>,
	): ViewTypes[T]["out"] | undefined {
		const entry = s.views[key];
		if (!entry) return undefined;
		const view = viewOf(entry.type);
		const clock: Clock = s.clock ?? { todayIso: "", tz: "UTC" };
		const table = (s.rows as unknown as LooseRows)[view.kind] ?? {};
		let out = view.patch(entry.base, (id) => table[id], clock);
		for (const p of s.pending) {
			if (p.kind === view.kind) out = view.reduce(out, p.intent, p.ctx, entry.params);
		}
		return out as ViewTypes[T]["out"];
	}

	/** Base plus pending deltas, clamped at zero. Undefined until seeded. */
	function selectAggregate(s: StoreState, key: AggregateKey): number | undefined {
		const base = s.aggregates[key];
		if (!base) return undefined;
		const value = s.pending.reduce((sum, p) => sum + (p.deltas[key] ?? 0), base.value);
		return Math.max(0, value);
	}

	return {
		initialState,
		applySeed,
		applyIntent,
		confirmWrite,
		rollbackWrite,
		selectView,
		selectAggregate,
	};
}

export type Core = ReturnType<typeof makeCore>;

export const core = makeCore(defaultAdapters);
export const { applySeed, applyIntent, confirmWrite, rollbackWrite, selectView, selectAggregate } =
	core;
