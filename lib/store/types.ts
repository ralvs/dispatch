// Client entity store (#25). Client-safe types only — no React, no zustand.
//
// Conflict rule (one rule for every kind, no migration). A version is the
// server instant at which a state was observed:
//   - a seed's version is its `readAt`, stamped BEFORE the read starts
//     (`stampRead` in ./server.ts);
//   - a local write's version is its `at`, stamped AFTER the write commits
//     (`stampWrite`).
// A confirmed write applies to any base whose `readAt < at` — at confirm time
// and at every later seed. A pending write always overlays. So a server seed
// never overwrites a fresher local write, a later read replaces a confirmed
// one, and a stale router-cache replay never regresses a fresher seed.
//
// `updated_at` is not used: row versions cannot order membership (a created
// row missing from a stale list, a deleted row still present) or aggregates,
// and `readAt` is needed for both anyway.
//
// Per-kind notes for the issues that add kinds (#27–#30):
//   - Tables with `updated_at`: the store ignores it; same rule.
//   - `quotes`, `journal_entries`, `person_facts`: edits are desired-state
//     patches; same rule.
//   - `notifications`: status is desired state; new cron rows arrive only via
//     seeds.
//   - `routine_completions`: identity is the natural key
//     `${routine_id}:${completed_date}` (unique constraint), not `id`.
//   - `person_interactions`: insert/delete only; reconciles by presence.
//   - `mentions`: derived server-side (ADR-0030); seeds only, no client intents.
//
// Adapter contract: `reduce` and `upsert` must be idempotent — a confirmed
// write can replay onto a seed that already contains it. Aggregate deltas are
// the exception: a concurrent read/write window may briefly double-count, and
// the next seed heals it.

import type { DaySchedulePayload } from "@/lib/day-schedule";
import type { TaskRow } from "@/lib/schemas/task";
import type { TaskIntent, TaskLists } from "@/lib/task-interaction/apply-intent";

/** UTC ISO instant, always server-stamped. */
export type Instant = string;
export type Clock = { todayIso: string; tz: string };

export type EntityMap = { task: TaskRow };
export type Kind = keyof EntityMap;
export type IntentMap = { task: TaskIntent };
export type AnyIntent = { [K in Kind]: { kind: K; intent: IntentMap[K] } }[Kind];

/** Which rows a flat task list admits when a write it has not seen arrives. */
export type TaskScope = { projectId: string } | { unfiled: true; status: "open" };

/**
 * `params` is what a view keeps from its seed besides its rows (a list's
 * scope) — the adapter needs it to admit rows the view has not seen.
 */
export type ViewTypes = {
	/** /tasks */
	taskLists: { kind: "task"; data: TaskLists; out: TaskLists; params: undefined };
	/** A project's list, the inbox. */
	taskList: {
		kind: "task";
		data: { rows: TaskRow[]; scope?: TaskScope };
		out: TaskRow[];
		params: TaskScope | undefined;
	};
	day: { kind: "task"; data: DaySchedulePayload; out: DaySchedulePayload; params: undefined };
};
export type ViewType = keyof ViewTypes;
export type ViewKey<T extends ViewType = ViewType> = string & { readonly __view: T };
export type ViewSeed = {
	[T in ViewType]: { key: ViewKey<T>; type: T; data: ViewTypes[T]["data"] };
}[ViewType];

/**
 * Entity issues extend this union. The `tasks.*` counts are Today's counters
 * (#26): open and overdue leave out quiet tasks, inbox is unfiled open tasks.
 */
export type AggregateKey =
	| "notes.needsReview"
	| "notifications.unread"
	| "tasks.open"
	| "tasks.overdue"
	| "tasks.inbox";
export type Deltas = Partial<Record<AggregateKey, number>>;

export type Snapshot = Clock & {
	readAt: Instant;
	views?: ViewSeed[];
	aggregates?: Partial<Record<AggregateKey, number>>;
};

export type StoreWrite<R = EntityMap[Kind]> = { at: Instant; rows: R[]; deletedIds?: string[] };
export type Token = number;
export type IntentCtx = Clock & { nowIso: Instant };
export type Pending = AnyIntent & { token: Token; ctx: IntentCtx; deltas: Deltas };
export type Confirmed = Pending & { write: StoreWrite };

export type RowEntry<R> = { row: R; v: Instant } | { deleted: true; v: Instant };
export type ViewEntry = {
	[T in ViewType]: {
		type: T;
		base: ViewTypes[T]["out"];
		params: ViewTypes[T]["params"];
		readAt: Instant;
	};
}[ViewType];

export type StoreState = {
	clock: (Clock & { readAt: Instant }) | null;
	/** Normalized by kind + id. */
	rows: { [K in Kind]: Record<string, RowEntry<EntityMap[K]>> };
	views: Record<string, ViewEntry>;
	aggregates: Partial<Record<AggregateKey, { value: number; readAt: Instant }>>;
	pending: Pending[];
	/** Capped at CONFIRMED_CAP (core.ts), oldest dropped. */
	confirmed: Confirmed[];
	nextToken: Token;
};

export type StoreActions = {
	seed(snap: Snapshot): void;
	/** Throws if the clock is null: the consumer sits outside any Seed. */
	apply(i: AnyIntent): Token;
	/** Unknown token: no-op. */
	confirm(token: Token, write: StoreWrite): void;
	/** Unknown token: no-op. */
	rollback(token: Token): void;
};

export type Store = StoreState & StoreActions;

type Out<T extends ViewType> = ViewTypes[T]["out"];
type RowOf<T extends ViewType> = EntityMap[ViewTypes[T]["kind"]];

/** Per view type: how intents and server rows fold into a view. */
export type ViewAdapter<T extends ViewType> = {
	kind: ViewTypes[T]["kind"];
	fromSeed(data: ViewTypes[T]["data"]): { base: Out<T>; params: ViewTypes[T]["params"] };
	/** Every row the view holds — seeds the normalized table. */
	rowsOf(view: Out<T>): RowOf<T>[];
	reduce(
		view: Out<T>,
		intent: IntentMap[ViewTypes[T]["kind"]],
		ctx: IntentCtx,
		params: ViewTypes[T]["params"],
	): Out<T>;
	/** Patch a row the view already has; admit one it does not when it belongs. */
	upsert(view: Out<T>, rows: RowOf<T>[], clock: Clock, params: ViewTypes[T]["params"]): Out<T>;
	remove(view: Out<T>, ids: ReadonlySet<string>, clock: Clock): Out<T>;
	/** Swap in the freshest row versions, drop tombstoned rows. Same reference when nothing changed. */
	patch(view: Out<T>, rowOf: (id: string) => RowEntry<RowOf<T>> | undefined, clock: Clock): Out<T>;
};

export type KindAdapter<K extends Kind> = {
	idOf(row: EntityMap[K]): string;
	/** Temporary ids an optimistic create introduced; dropped on commit. */
	provisionalIds(intent: IntentMap[K]): string[];
	/** Aggregate deltas, computed at apply from the row before the intent. */
	deltas?(intent: IntentMap[K], before: EntityMap[K] | undefined, ctx: IntentCtx): Deltas;
};

export type Adapters = {
	kinds: { [K in Kind]: KindAdapter<K> };
	views: { [T in ViewType]: ViewAdapter<T> };
};
