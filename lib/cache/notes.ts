import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CachedReader } from "@/lib/cache/manifest";
import { CacheTag } from "@/lib/cache/tags";
import { listBacklinks, listLinksForNote, listLinkTargetLabels } from "@/lib/services/note-links";
import { listNotes, listNoteTitles } from "@/lib/services/notes";
import { listMentionCandidates } from "@/lib/services/people";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for /notes (docs/adr/0035). Admin client after
 * requireOwnerPage(), as in lib/cache/today.ts.
 *
 * The needs_review band is written by the sweep cron as well as by the app, so
 * this entry depends on app/api/cron/sweep busting `notes` — it does.
 */
export async function getCachedNoteLists() {
	"use cache";
	cacheTag(CacheTag.notes);
	cacheLife("tagged");

	const sb = createAdminClient();
	const [needsReview, allNotes] = await Promise.all([
		listNotes(sb, { needsReview: true }),
		listNotes(sb, { needsReview: false }),
	]);
	return { needsReview, allNotes };
}

/*
 * /notes/[id] caches everything except the note itself. The editor autosaves,
 * and every save is a notes.write that would bust a cached body at once — and
 * the uncached getNote is one query that also decides the 404.
 */

/** The editor's autocomplete: wikilink titles and @mention candidates. */
export async function getCachedNoteEditorContext() {
	"use cache";
	cacheTag(CacheTag.notes, CacheTag.people);
	cacheLife("tagged");

	const sb = createAdminClient();
	const [noteTitles, people] = await Promise.all([listNoteTitles(sb), listMentionCandidates(sb)]);
	return { noteTitles, people };
}

/**
 * The link rail: backlinks, this note's links, and labels for its manual
 * targets. Task labels move with task writes; event labels with the calendar
 * writes that bust the day schedule.
 */
export async function getCachedNoteLinks(noteId: string) {
	"use cache";
	cacheTag(CacheTag.notes, CacheTag.tasks, CacheTag.daySchedule);
	cacheLife("tagged");

	const sb = createAdminClient();
	const [backlinks, links] = await Promise.all([
		listBacklinks(sb, noteId),
		listLinksForNote(sb, noteId),
	]);
	const manual = links.filter((l) => l.kind === "manual");
	const targets = await listLinkTargetLabels(
		sb,
		manual.flatMap((l) => (l.target_type === "task" && l.target_task_id ? [l.target_task_id] : [])),
		manual.flatMap((l) =>
			l.target_type === "event" && l.target_event_id ? [l.target_event_id] : [],
		),
	);
	return { backlinks, links, targets };
}

const noteWrites = {
	tag: CacheTag.notes,
	writes: ["notes.write", "capture.settled"],
	external: ["capture", "sweep"],
} satisfies CachedReader["reads"][number];

export const readers: CachedReader[] = [
	{
		reader: "getCachedNoteLists",
		reads: [
			{
				tag: CacheTag.notes,
				writes: ["notes.write", "capture.settled", "settings.timezone"],
				external: ["capture", "sweep"],
			},
		],
	},
	{
		reader: "getCachedNoteEditorContext",
		reads: [noteWrites, { tag: CacheTag.people, writes: ["people.write"] }],
	},
	{
		reader: "getCachedNoteLinks",
		reads: [
			noteWrites,
			{
				tag: CacheTag.tasks,
				writes: ["task.write", "task.assign", "capture.settled"],
				external: ["capture", "sweep"],
			},
			{
				tag: CacheTag.daySchedule,
				writes: ["capture.settled", "today.only"],
				external: ["capture", "sweep", "cronCaldav", "calendarBridge"],
			},
		],
	},
];
