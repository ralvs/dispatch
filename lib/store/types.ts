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
//     patches; same rule. The create-only lists share one factory
//     (kinds/record.ts).
//   - `notifications`: status is desired state; new cron rows arrive only via
//     seeds. A dismissal is a delete (kinds/notification.ts).
//   - `routine_completions`: identity is the natural key
//     `${routine_id}:${completed_date}` (unique constraint), not `id` — held
//     as a date in its routine's row (kinds/routine.ts).
//   - `person_interactions`: insert/delete only; reconciles by presence.
//   - `mentions`: derived server-side (ADR-0030); seeds only, no client intents.
//
// Adapter contract: `reduce` and `upsert` must be idempotent — a confirmed
// write can replay onto a seed that already contains it. Aggregate deltas are
// the exception: a concurrent read/write window may briefly double-count, and
// the next seed heals it.

import type { DaySchedulePayload } from "@/lib/day-schedule";
import type { DomainItem } from "@/lib/schemas/domain";
import type { JournalEntryRow } from "@/lib/schemas/journal";
import type { LinkRow } from "@/lib/schemas/link";
import type { NoteListRow } from "@/lib/schemas/note";
import type { NotificationRow } from "@/lib/schemas/notification";
import type { PersonFactRow, PersonInteractionRow, PersonRow } from "@/lib/schemas/person";
import type { ProjectRow } from "@/lib/schemas/project";
import type { QuoteRow } from "@/lib/schemas/quote";
import type { RoutineWithHistory } from "@/lib/schemas/routine";
import type { TaskRow } from "@/lib/schemas/task";
import type { NoteIntent, NoteLists } from "@/lib/store/kinds/note";
import type { NotificationIntent } from "@/lib/store/kinds/notification";
import type { OfPerson, PersonScope } from "@/lib/store/kinds/person";
import type { ProjectScope } from "@/lib/store/kinds/project";
import type { RecordIntent, RecordSeed } from "@/lib/store/kinds/record";
import type { RoutineIntent } from "@/lib/store/kinds/routine";
import type { TaskLists } from "@/lib/store/kinds/task";
import type { TaskIntent } from "@/lib/task-interaction/apply-intent";

/** UTC ISO instant, always server-stamped. */
export type Instant = string;
/**
 * What the adapters need from the server besides rows: its today, the app
 * timezone, and the quiet projects (lib/quiet.ts) — absent until a page that
 * shows task counts seeds them, and then replaced only by a seed read later
 * than the one they came from.
 */
export type Clock = { todayIso: string; tz: string; quietProjectIds?: readonly string[] };

export type { NoteLists };

export type EntityMap = {
	task: TaskRow;
	notification: NotificationRow;
	routine: RoutineWithHistory;
	note: NoteListRow;
	quote: QuoteRow;
	journal: JournalEntryRow;
	link: LinkRow;
	person: PersonRow;
	personFact: PersonFactRow;
	personInteraction: PersonInteractionRow;
	project: ProjectRow;
	domain: DomainItem;
};
export type Kind = keyof EntityMap;
export type IntentMap = {
	task: TaskIntent;
	notification: NotificationIntent;
	routine: RoutineIntent;
	note: NoteIntent;
	quote: RecordIntent<QuoteRow>;
	journal: RecordIntent<JournalEntryRow>;
	link: RecordIntent<LinkRow>;
	person: RecordIntent<PersonRow>;
	personFact: RecordIntent<PersonFactRow>;
	personInteraction: RecordIntent<PersonInteractionRow>;
	project: RecordIntent<ProjectRow>;
	domain: RecordIntent<DomainItem>;
};
export type AnyIntent = { [K in Kind]: { kind: K; intent: IntentMap[K] } }[Kind];

/** Which rows a flat task list admits when a write it has not seen arrives. */
export type TaskScope =
	| { projectId: string }
	| { unfiled: true; status: "open" }
	/** Every task tagged with a project — the /projects board's rows. */
	| { anyProject: true };

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
	/** /notifications: the visible ledger, newest first. Dismissed rows never show. */
	notificationList: {
		kind: "notification";
		data: NotificationRow[];
		out: NotificationRow[];
		params: undefined;
	};
	/** /notes: the needs-review band and every other note, each in list order. */
	noteLists: { kind: "note"; data: NoteLists; out: NoteLists; params: undefined };
	/** /routines and Today's routines card: the listed routines, in list order. */
	routineList: {
		kind: "routine";
		data: RoutineWithHistory[];
		out: RoutineWithHistory[];
		params: undefined;
	};
	/** /quotes, newest first. */
	quoteList: RecordView<"quote">;
	/** /journal, by day, newest first. */
	journalList: RecordView<"journal">;
	/** /links: unread and read, newest first. Dismissed rows never show. */
	linkList: RecordView<"link">;
	/** /people by name; scoped to one person, that person's page. */
	personList: RecordView<"person", PersonScope>;
	/** One person's facts, undated first, then by date. */
	personFactList: RecordView<"personFact", OfPerson>;
	/** One person's interactions, newest first. */
	personInteractionList: RecordView<"personInteraction", OfPerson>;
	/** /projects by name; scoped to one project, that project's page. */
	projectList: RecordView<"project", ProjectScope>;
	/** /domains: active first, then by name. */
	domainList: RecordView<"domain">;
};
/** A list built by kinds/record.ts. */
type RecordView<K extends Kind, S = undefined> = {
	kind: K;
	data: RecordSeed<EntityMap[K], S>;
	out: EntityMap[K][];
	params: S | undefined;
};
export type ViewType = keyof ViewTypes;
export type ViewKey<T extends ViewType = ViewType> = string & { readonly __view: T };
export type ViewSeed = {
	[T in ViewType]: { key: ViewKey<T>; type: T; data: ViewTypes[T]["data"] };
}[ViewType];

/**
 * Entity issues extend this union. The `tasks.*` counts are Today's counters
 * (#26): open, overdue and inbox leave out quiet tasks; inbox is unfiled open
 * tasks.
 * `project.done:<id>` and `project.open:<id>` are one per project, seeded by
 * /projects and by Today's projects card.
 */
export type AggregateKey =
	| "notes.needsReview"
	| "notifications.unread"
	| "tasks.open"
	| "tasks.overdue"
	| "tasks.inbox"
	/** Today's calendar events — the counters' first row. Seeds only: a crons' write (#4). */
	| "events.today"
	/** Done tasks in one project — the /projects row's `n/m done` (#30). */
	| `project.done:${string}`
	/** Open tasks in one project — with `project.done`, Today's project rings (#31). */
	| `project.open:${string}`;
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
	/** `quietReadAt`: the read the quiet projects came from, versioned on their own. */
	clock: (Clock & { readAt: Instant; quietReadAt?: Instant }) | null;
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
	/** The row an intent acts on, whose state before it `deltas` reads. Undefined: no one row. */
	targetId(intent: IntentMap[K]): string | undefined;
	/** Temporary ids an optimistic create introduced; dropped on commit. */
	provisionalIds(intent: IntentMap[K]): string[];
	/**
	 * One row after a pending intent; the row unchanged when the intent does
	 * not touch it. When given, `deltas` sees the row as the user sees it —
	 * with every intent still in flight folded on — so two quick changes to
	 * one row move a count once. Omitted: `deltas` sees the stored row. `ctx`
	 * is the pending intent's own, taken when it was applied. Undefined: a
	 * pending intent removed the row, and `deltas` sees no row at all.
	 */
	project?(row: EntityMap[K], intent: IntentMap[K], ctx: IntentCtx): EntityMap[K] | undefined;
	/**
	 * Aggregate deltas, computed at apply from the row before the intent.
	 * `current` reads an aggregate as the user sees it then (pending included),
	 * for an intent that sets a count rather than moving it by one.
	 */
	deltas?(
		intent: IntentMap[K],
		before: EntityMap[K] | undefined,
		ctx: IntentCtx,
		current: (key: AggregateKey) => number | undefined,
	): Deltas;
	/**
	 * The deltas to keep once the server answered. Called at confirm; the
	 * result is what later seeds replay. Omitted: the applied deltas stand.
	 */
	settle?(intent: IntentMap[K], write: StoreWrite<EntityMap[K]>, deltas: Deltas): Deltas;
};

export type Adapters = {
	kinds: { [K in Kind]: KindAdapter<K> };
	views: { [T in ViewType]: ViewAdapter<T> };
};
