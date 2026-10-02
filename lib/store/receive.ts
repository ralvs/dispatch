// Rows the server wrote that no intent in this tab predicted — a palette
// capture's: the parser decides what a capture writes, so the client has
// nothing to apply before the answer (docs/adr/0069 §5). Client-safe.

import type { JournalEntryRow } from "@/lib/schemas/journal";
import type { NoteListRow } from "@/lib/schemas/note";
import type { QuoteRow } from "@/lib/schemas/quote";
import type { TaskRow } from "@/lib/schemas/task";
import type { AnyIntent, Clock, EntityMap, Instant, Kind, StoreActions } from "@/lib/store/types";

export type ReceivedRows = {
	task: TaskRow[];
	note: NoteListRow[];
	quote: QuoteRow[];
	journal: JournalEntryRow[];
};

/**
 * `readAt` is stamped before the write started and `at` after it committed,
 * like any write's (lib/store/server.ts). `todayIso` and `tz` are the clock a
 * page with no seed of its own still needs.
 */
export type Received = Clock & { readAt: Instant; at: Instant; rows: ReceivedRows };

/**
 * Each row goes in as a create the server already confirmed: every view that
 * would list it does, every count it moves moves (a task's open and inbox, a
 * flagged note's review count), and a seed read before `at` replays it, as
 * for any confirmed write.
 */
export function receiveRows(store: StoreActions, received: Received): void {
	const { readAt, todayIso, tz, at, rows } = received;
	// No views: this only gives the store a clock when no page seeded one.
	store.seed({ readAt, todayIso, tz });
	type Create = [AnyIntent, EntityMap[Kind]];
	const creates: Create[] = [
		...rows.task.map((task): Create => [{ kind: "task", intent: { type: "create", task } }, task]),
		...rows.note.map((row): Create => [{ kind: "note", intent: { type: "create", row } }, row]),
		...rows.quote.map((row): Create => [{ kind: "quote", intent: { type: "create", row } }, row]),
		...rows.journal.map(
			(row): Create => [{ kind: "journal", intent: { type: "create", row } }, row],
		),
	];
	for (const [intent, row] of creates) store.confirm(store.apply(intent), { at, rows: [row] });
}
