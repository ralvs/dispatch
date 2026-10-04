import type { ReaderDecl } from "@/lib/cache/reader";
import type { CacheTagName } from "@/lib/cache/tags";
import type { Database } from "@/lib/database.types";
import {
	EXTERNAL_WRITES,
	type ExternalWriter,
	invalidationFor,
	type MutationKind,
} from "@/lib/invalidate";

export type Table = keyof Database["public"]["Tables"];

/** Something that announces a write: an in-app mutation kind or a cron/`/api/*` writer. */
export type Writer = MutationKind | ExternalWriter;

/**
 * Who announces a write to each table (docs/adr/0078). Hand-stated: each
 * entry lists the mutation kinds an action calls when it writes the table
 * directly, and the external writers whose kinds are not already listed.
 *
 * Left out on purpose:
 * - FK cascades (deleting a task drops its note_links and mentions rows); the
 *   kind that deletes the parent is the one that announces it.
 * - Columns no reader shows, such as the reminders cron writing
 *   `tasks.reminder_sent_at`.
 *
 * A cached reader that declares a table depends on every writer listed here;
 * `lib/cache/readers.test.ts` fails when one of them busts none of its tags.
 */
export const TABLE_WRITERS: { readonly [T in Table]: readonly Writer[] } = {
	app_settings: ["settings.timezone", "settings.reminders"],
	calendar_events: ["capture.event", "today.only"],
	caldav_sync_state: ["today.only"],
	google_sync_state: ["today.only"],
	captured_data: ["capture.settled", "capture.event"],
	ingest_links: ["links.write"],
	journal_books: ["journal.write"],
	journal_entries: ["journal.write", "capture.settled", "capture.event"],
	mentions: ["task.write", "notes.write", "people.write", "capture.settled", "capture.event"],
	note_links: ["notes.write", "notes.links", "capture.settled", "capture.event"],
	notes: ["notes.write", "capture.settled", "capture.event"],
	notifications: ["notification.write"],
	observations: ["cronObservations"],
	people: ["people.write"],
	person_facts: ["people.write"],
	person_interactions: ["people.write"],
	projects: ["projects.write", "projects.detail"],
	push_subscriptions: [],
	quotes: ["quotes.write", "capture.settled", "capture.event"],
	quote_annotations: ["quotes.write"],
	resurfacing_seen: ["today.only"],
	routines: ["routine.write"],
	routine_completions: ["routine.write"],
	stewardship_domains: ["settings.domain"],
	tasks: ["task.write", "task.assign", "capture.settled", "capture.event"],
};

function isExternal(w: Writer): w is ExternalWriter {
	return Object.hasOwn(EXTERNAL_WRITES, w);
}

/** The tags a writer busts. An external writer busts the union over its kinds. */
export function tagsBustedBy(w: Writer): CacheTagName[] {
	if (!isExternal(w)) return invalidationFor(w).tags;
	const kinds: readonly MutationKind[] = EXTERNAL_WRITES[w];
	return [...new Set(kinds.flatMap((k) => invalidationFor(k).tags))];
}

/** Every writer of a declared table that busts none of the reader's tags. */
export function missingBusts(d: ReaderDecl): { table: Table; writer: Writer }[] {
	const misses: { table: Table; writer: Writer }[] = [];
	for (const table of d.tables) {
		for (const writer of TABLE_WRITERS[table]) {
			if (!tagsBustedBy(writer).some((t) => d.tags.includes(t))) misses.push({ table, writer });
		}
	}
	return misses;
}
