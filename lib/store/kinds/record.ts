// Record kinds (#30): the lists that only create, edit and delete rows —
// quotes, journal entries, links, people and their facts and interactions,
// projects, domains. Their intents are the same three, and an edit names the
// fields it wants (desired state), so a replayed write is idempotent. One
// factory builds each kind's adapters, so the six lists cannot drift on what
// a create or a delete means.

import type { RowEntry } from "@/lib/store/types";

type Identified = { id: string };

export type RecordIntent<R> =
	| { type: "create"; row: R }
	| { type: "patch"; id: string; patch: Partial<R> }
	| { type: "delete"; id: string };

/** What a record view is seeded with: its rows, and what a row needs to join it. */
export type RecordSeed<R, S = undefined> = { rows: R[]; scope?: S };

export type RecordListOptions<R, S> = {
	/** False: the row is in no list (archived, dismissed). Default: every row. */
	listed?: (row: R) => boolean;
	/** Whether a row the view has not seen joins it. Default: every listed row. */
	belongs?: (row: R, scope: S | undefined) => boolean;
	/** The server's list order. A new or edited row takes its place by it. Omitted: a new row goes first. */
	compare?: (a: R, b: R) => number;
};

export function recordKind<R extends Identified>() {
	return {
		idOf: (row: R) => row.id,
		targetId: (intent: RecordIntent<R>) => (intent.type === "create" ? intent.row.id : intent.id),
		provisionalIds: (intent: RecordIntent<R>) => (intent.type === "create" ? [intent.row.id] : []),
	};
}

/** The view after one intent: the same reference when the intent does not touch it. */
export function applyRecordIntent<R extends Identified, S>(
	view: R[],
	intent: RecordIntent<R>,
	scope: S | undefined,
	opts: RecordListOptions<R, S>,
): R[] {
	const listed = opts.listed ?? (() => true);
	switch (intent.type) {
		case "create": {
			const joins = opts.belongs ? opts.belongs(intent.row, scope) : true;
			if (!joins || !listed(intent.row) || view.some((r) => r.id === intent.row.id)) return view;
			return place(view, intent.row, opts.compare);
		}
		case "patch": {
			const row = view.find((r) => r.id === intent.id);
			if (!row) return view;
			return put(view, { ...row, ...intent.patch }, listed, opts.compare);
		}
		case "delete":
			return view.some((r) => r.id === intent.id) ? view.filter((r) => r.id !== intent.id) : view;
	}
}

/** Insert where `compare` puts it; first when there is no order. */
function place<R>(view: R[], row: R, compare?: (a: R, b: R) => number): R[] {
	if (!compare) return [row, ...view];
	const at = view.findIndex((r) => compare(row, r) < 0);
	return at === -1 ? [...view, row] : [...view.slice(0, at), row, ...view.slice(at)];
}

/** Replace a row the view holds, re-placing it if its sort key moved; drop it once unlisted. */
function put<R extends Identified>(
	view: R[],
	row: R,
	listed: (row: R) => boolean,
	compare?: (a: R, b: R) => number,
): R[] {
	const rest = view.filter((r) => r.id !== row.id);
	if (!listed(row)) return rest;
	if (!compare) return view.map((r) => (r.id === row.id ? row : r));
	return place(rest, row, compare);
}

export function recordListView<R extends Identified, S = undefined>(opts: RecordListOptions<R, S>) {
	const listed = opts.listed ?? (() => true);
	return {
		fromSeed: (data: RecordSeed<R, S>) => ({ base: data.rows, params: data.scope }),
		rowsOf: (view: R[]) => view,
		reduce: (view: R[], intent: RecordIntent<R>, _ctx: unknown, scope: S | undefined) =>
			applyRecordIntent(view, intent, scope, opts),
		upsert: (view: R[], rows: R[], _clock: unknown, scope: S | undefined) => {
			let out = view;
			for (const row of rows) {
				if (out.some((r) => r.id === row.id)) {
					out = put(out, row, listed, opts.compare);
				} else if (listed(row) && (opts.belongs ? opts.belongs(row, scope) : true)) {
					// A create the server confirmed, or one a write elsewhere made.
					out = place(out, row, opts.compare);
				}
			}
			return out;
		},
		remove: (view: R[], ids: ReadonlySet<string>) =>
			view.some((r) => ids.has(r.id)) ? view.filter((r) => !ids.has(r.id)) : view,
		patch: (view: R[], rowOf: (id: string) => RowEntry<R> | undefined) => {
			let changed = false;
			const out: R[] = [];
			for (const row of view) {
				const entry = rowOf(row.id);
				if (entry === undefined) {
					out.push(row);
				} else if ("deleted" in entry || !listed(entry.row)) {
					changed = true;
				} else {
					if (entry.row !== row) changed = true;
					out.push(entry.row);
				}
			}
			return changed ? out : view;
		},
	};
}

/**
 * Newest first by a column holding an instant or a `YYYY-MM-DD` date. Instants
 * compare as instants: the server writes `+00:00`, an optimistic row `Z`.
 */
export function newestFirst<R>(key: (row: R) => string | null) {
	return (a: R, b: R) => {
		const ka = key(a);
		const kb = key(b);
		if (ka === kb) return 0;
		if (ka === null) return 1;
		if (kb === null) return -1;
		return Date.parse(kb) - Date.parse(ka);
	};
}
