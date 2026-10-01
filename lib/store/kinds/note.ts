// The note kind (#27). /notes shows two lists: notes the parser could not
// place (needs_review) and every other note. A row's `needs_review` decides
// which list holds it, so filing one moves it, and the sweep cron's own
// filings arrive the same way through the next seed.
//
// The body is on the row (the list reads it for the title fallback), so an
// editor save confirms here and a changed title shows in the list.

import type { NoteListRow } from "@/lib/schemas/note";
import type { Deltas, IntentCtx, KindAdapter, RowEntry, ViewAdapter } from "@/lib/store/types";

export type NoteIntent =
	| { type: "pin"; id: string; pinned: boolean }
	| { type: "resolve"; id: string }
	| { type: "file"; id: string; domainId: string | null }
	| { type: "save"; id: string; title: string | null; body: string }
	| { type: "delete"; id: string }
	/** No optimistic change: a write made elsewhere (the attachments route) confirms its row. */
	| { type: "touch"; id: string };

export type NoteLists = { needsReview: NoteListRow[]; all: NoteListRow[] };

/** The row after the intent. Undefined: the intent removed it. */
export function applyNoteIntent(
	row: NoteListRow,
	intent: NoteIntent,
	nowIso: string,
): NoteListRow | undefined {
	if (intent.id !== row.id) return row;
	switch (intent.type) {
		case "pin": {
			if ((row.pinned_at !== null) === intent.pinned) return row;
			return { ...row, pinned_at: intent.pinned ? nowIso : null };
		}
		case "resolve":
			return row.needs_review ? { ...row, needs_review: false } : row;
		case "file":
			return row.domain_id === intent.domainId ? row : { ...row, domain_id: intent.domainId };
		case "save":
			return row.title === intent.title && row.body === intent.body
				? row
				: { ...row, title: intent.title, body: intent.body };
		case "delete":
			return undefined;
		case "touch":
			return row;
	}
}

/**
 * Today's and /notes' needs-review count moves when a flagged note is filed
 * or deleted — as the user sees the row (`project`), so filing then deleting
 * moves it once.
 */
function noteDeltas(intent: NoteIntent, before: NoteListRow | undefined, _ctx: IntentCtx): Deltas {
	if (intent.type !== "resolve" && intent.type !== "delete") return {};
	return before?.needs_review ? { "notes.needsReview": -1 } : {};
}

export const noteKind: KindAdapter<"note"> = {
	idOf: (row) => row.id,
	targetId: (intent) => intent.id,
	provisionalIds: () => [],
	// For counting only: the pin instant does not matter, and a deleted row is
	// left as it was — nothing after a delete can reach it.
	project: (row, intent) => applyNoteIntent(row, intent, row.created_at) ?? row,
	deltas: noteDeltas,
};

/** The server's order (listNotes): pinned first, newest pin first, then newest. */
function byListOrder(a: NoteListRow, b: NoteListRow): number {
	if (a.pinned_at !== b.pinned_at) {
		if (a.pinned_at === null) return 1;
		if (b.pinned_at === null) return -1;
		return a.pinned_at < b.pinned_at ? 1 : -1;
	}
	return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
}

/** Put each row in the list its flag names; keep rows that did not move where they are. */
function place(view: NoteLists, rows: NoteListRow[]): NoteLists {
	let { needsReview, all } = view;
	for (const row of rows) {
		const want = row.needs_review ? needsReview : all;
		if (want.some((r) => r.id === row.id)) {
			const replace = (list: NoteListRow[]) => list.map((r) => (r.id === row.id ? row : r));
			if (row.needs_review) needsReview = replace(needsReview);
			else all = replace(all);
			continue;
		}
		const other = row.needs_review ? all : needsReview;
		const rest = other.filter((r) => r.id !== row.id);
		if (row.needs_review) {
			all = rest;
			needsReview = [...needsReview, row].sort(byListOrder);
		} else {
			needsReview = rest;
			all = [...all, row].sort(byListOrder);
		}
	}
	return needsReview === view.needsReview && all === view.all ? view : { needsReview, all };
}

function mapLists(
	view: NoteLists,
	fn: (row: NoteListRow) => NoteListRow | undefined,
): { lists: NoteLists; moved: NoteListRow[] } {
	let changed = false;
	const moved: NoteListRow[] = [];
	const step = (list: NoteListRow[], flagged: boolean) => {
		const out: NoteListRow[] = [];
		for (const row of list) {
			const next = fn(row);
			if (next !== row) changed = true;
			if (next === undefined) continue;
			if (next.needs_review !== flagged) moved.push(next);
			else out.push(next);
		}
		return out;
	};
	const needsReview = step(view.needsReview, true);
	const all = step(view.all, false);
	if (!changed) return { lists: view, moved };
	return { lists: { needsReview, all }, moved };
}

export const noteListsView: ViewAdapter<"noteLists"> = {
	kind: "note",
	fromSeed: (data) => ({ base: data, params: undefined }),
	rowsOf: (view) => [...view.needsReview, ...view.all],
	reduce: (view, intent, ctx) => {
		const { lists, moved } = mapLists(view, (row) => applyNoteIntent(row, intent, ctx.nowIso));
		return moved.length > 0 ? place(lists, moved) : lists;
	},
	// A row the lists have not seen is admitted: every note belongs on /notes.
	upsert: (view, rows) => place(view, rows),
	remove: (view, ids) => mapLists(view, (row) => (ids.has(row.id) ? undefined : row)).lists,
	patch: (view, rowOf) => {
		const { lists, moved } = mapLists(view, (row) => {
			const entry: RowEntry<NoteListRow> | undefined = rowOf(row.id);
			if (entry === undefined) return row;
			return "deleted" in entry ? undefined : entry.row;
		});
		return moved.length > 0 ? place(lists, moved) : lists;
	},
};
