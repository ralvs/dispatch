// The journal kind (#30). /journal lists entries by day, newest first, and the
// newest entry first within a day (listEntries). No `updated_at`: an edit is a
// desired-state patch (./record.ts).

import type { JournalEntryRow } from "@/lib/schemas/journal";
import {
	newestFirst,
	type RecordIntent,
	recordKind,
	recordListView,
} from "@/lib/store/kinds/record";
import type { KindAdapter, ViewAdapter } from "@/lib/store/types";

export type JournalIntent = RecordIntent<JournalEntryRow>;

const byDay = newestFirst<JournalEntryRow>((e) => e.entry_date);
const byCreated = newestFirst<JournalEntryRow>((e) => e.created_at);

export const journalKind: KindAdapter<"journal"> = recordKind<JournalEntryRow>();

export const journalListView: ViewAdapter<"journalList"> = {
	kind: "journal",
	...recordListView<JournalEntryRow>({ compare: (a, b) => byDay(a, b) || byCreated(a, b) }),
};
