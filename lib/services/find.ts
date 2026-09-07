import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	escapeLike,
	FIND_FETCH_CAP,
	FIND_GROUP_CAP,
	FIND_MIN_QUERY,
	FIND_RECENTS,
	noteField,
	noteScore,
	sanitizeFindQuery,
	snippetAround,
	taskField,
	taskScore,
} from "@/lib/find/match";
import { displayTitle } from "@/lib/note-display";
import { unwrap } from "@/lib/services/errors";

export type FindTaskHit = {
	kind: "task";
	id: string;
	title: string;
	status: "open" | "done";
	field: "title" | "notes";
	snippet: string | null;
	href: string;
};

export type FindNoteHit = {
	kind: "note";
	id: string;
	title: string;
	needsReview: boolean;
	field: "title" | "body";
	snippet: string | null;
	href: string;
};

export type FindResult = {
	query: string;
	recents: boolean;
	tasks: FindTaskHit[];
	notes: FindNoteHit[];
};

type TaskRow = {
	id: string;
	title: string;
	notes: string | null;
	status: "open" | "done";
	created_at: string;
};

type NoteRow = {
	id: string;
	title: string | null;
	body: string;
	needs_review: boolean;
	created_at: string;
};

function toTaskHit(row: TaskRow, query: string, recents: boolean): FindTaskHit {
	const field = recents ? "title" : taskField(row.title, query);
	const snippet =
		!recents && field === "notes" && row.notes ? snippetAround(row.notes, query) : null;
	return {
		kind: "task",
		id: row.id,
		title: row.title,
		status: row.status,
		field,
		snippet,
		href: `/tasks?edit=${row.id}`,
	};
}

function toNoteHit(row: NoteRow, query: string, recents: boolean): FindNoteHit {
	const field = recents ? "title" : noteField(row.title, query);
	const snippet = !recents && field === "body" ? snippetAround(row.body, query) : null;
	return {
		kind: "note",
		id: row.id,
		title: displayTitle(row),
		needsReview: row.needs_review,
		field,
		snippet,
		href: `/notes/${row.id}`,
	};
}

async function recents(sb: SupabaseClient): Promise<FindResult> {
	const [taskRows, noteRows] = await Promise.all([
		unwrap(
			await sb
				.from("tasks")
				.select("id, title, notes, status, created_at")
				.eq("status", "open")
				.order("created_at", { ascending: false })
				.limit(FIND_RECENTS),
		),
		unwrap(
			await sb
				.from("notes")
				.select("id, title, body, needs_review, created_at")
				.order("created_at", { ascending: false })
				.limit(FIND_RECENTS),
		),
	]);
	return {
		query: "",
		recents: true,
		tasks: ((taskRows ?? []) as TaskRow[]).map((row) => toTaskHit(row, "", true)),
		notes: ((noteRows ?? []) as NoteRow[]).map((row) => toNoteHit(row, "", true)),
	};
}

/**
 * Locate a task or a note. Empty / short queries return recents rather than
 * a blank box. Quiet and done tasks still appear — Find is not Today.
 */
export async function find(sb: SupabaseClient, raw: string): Promise<FindResult> {
	const query = sanitizeFindQuery(raw);
	if (query.length < FIND_MIN_QUERY) return recents(sb);

	const like = `%${escapeLike(query)}%`;
	const [taskRows, noteRows] = await Promise.all([
		unwrap(
			await sb
				.from("tasks")
				.select("id, title, notes, status, created_at")
				.or(`title.ilike.${like},notes.ilike.${like}`)
				.order("created_at", { ascending: false })
				.limit(FIND_FETCH_CAP),
		),
		unwrap(
			await sb
				.from("notes")
				.select("id, title, body, needs_review, created_at")
				.or(`title.ilike.${like},body.ilike.${like}`)
				.order("created_at", { ascending: false })
				.limit(FIND_FETCH_CAP),
		),
	]);

	const tasks = ((taskRows ?? []) as TaskRow[])
		.map((row) => ({ row, score: taskScore({ ...row, query }) }))
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score || b.row.created_at.localeCompare(a.row.created_at))
		.slice(0, FIND_GROUP_CAP)
		.map((item) => toTaskHit(item.row, query, false));

	const notes = ((noteRows ?? []) as NoteRow[])
		.map((row) => ({
			row,
			score: noteScore({
				title: row.title,
				body: row.body,
				needsReview: row.needs_review,
				query,
			}),
		}))
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score || b.row.created_at.localeCompare(a.row.created_at))
		.slice(0, FIND_GROUP_CAP)
		.map((item) => toNoteHit(item.row, query, false));

	return { query, recents: false, tasks, notes };
}
