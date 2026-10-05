import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as domains from "@/lib/cache/domains";
import * as inbox from "@/lib/cache/inbox";
import * as journal from "@/lib/cache/journal";
import * as links from "@/lib/cache/links";
import * as notes from "@/lib/cache/notes";
import * as notifications from "@/lib/cache/notifications";
import * as people from "@/lib/cache/people";
import * as projects from "@/lib/cache/projects";
import * as quotes from "@/lib/cache/quotes";
import type { ReaderDecl } from "@/lib/cache/reader";
import * as routines from "@/lib/cache/routines";
import * as settings from "@/lib/cache/settings";
import * as tasks from "@/lib/cache/tasks";
import * as today from "@/lib/cache/today";
import { TABLE_WRITERS } from "@/lib/cache/writers";
import { serviceClient } from "@/test/integration/clients";

// Each cached reader against the real tables, through a client that records
// every table it touches (docs/adr/0078). A reader's declared `tables` must be
// exactly what it reads, so TABLE_WRITERS can work out who moves its data.

vi.mock("next/cache", () => ({
	cacheTag: () => {},
	cacheLife: () => {},
	revalidateTag: () => {},
	updateTag: () => {},
}));

const known = new Set(Object.keys(TABLE_WRITERS));
const touched = new Set<string>();
let rpcCalls: string[] = [];

/** `note:notes!note_links_note_id_fkey(id)` embeds `notes`. */
function embeddedTables(select: string): string[] {
	return [...select.matchAll(/(?:\w+:)?(\w+)(?:!\w+)?\s*\(/g)]
		.map((m) => m[1])
		.filter((t) => known.has(t));
}

function recording(sb: SupabaseClient): SupabaseClient {
	return new Proxy(sb, {
		get(target, prop, receiver) {
			if (prop === "rpc") {
				return (fn: string) => {
					rpcCalls.push(fn);
					throw new Error(`a cached reader called rpc("${fn}")`);
				};
			}
			if (prop !== "from") return Reflect.get(target, prop, receiver);
			return (table: string) => {
				touched.add(table);
				const builder = target.from(table);
				return new Proxy(builder, {
					get(b, p, r) {
						const value = Reflect.get(b, p, r);
						if (p !== "select" || typeof value !== "function") return value;
						return (columns?: string, ...rest: unknown[]) => {
							if (typeof columns === "string") {
								for (const t of embeddedTables(columns)) touched.add(t);
							}
							return value.call(b, columns, ...rest);
						};
					},
				});
			};
		},
	});
}

let client: SupabaseClient | undefined;
vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: () => {
		client ??= recording(serviceClient());
		return client;
	},
}));

const TZ = "America/Sao_Paulo";
const TODAY = "2026-10-04";

type Seeded = { personId: string; projectId: string; noteId: string };
let seeded: Seeded;

async function insert<T = { id: string }>(
	sb: SupabaseClient,
	table: string,
	row: Record<string, unknown>,
): Promise<T> {
	const { data, error } = await sb.from(table).insert(row).select("id").single();
	if (error) throw new Error(`${table}: ${error.message}`);
	return data as T;
}

/** One row on every branch a reader can take. */
async function seed(): Promise<Seeded> {
	const sb = serviceClient();
	const domain = await insert(sb, "stewardship_domains", { name: "Home" });
	const project = await insert(sb, "projects", { name: "Roof", domain_id: domain.id });
	const person = await insert(sb, "people", { name: "Ana" });
	const filed = await insert(sb, "tasks", { title: "Call Ana", project_id: project.id });
	await insert(sb, "tasks", { title: "Unfiled", due_date: TODAY });
	await insert(sb, "tasks", {
		title: "Done",
		status: "done",
		completed_at: `${TODAY}T12:00:00Z`,
		project_id: project.id,
	});
	await insert(sb, "mentions", {
		person_id: person.id,
		matched_name: "Ana",
		source_type: "task",
		task_id: filed.id,
	});
	await insert(sb, "person_facts", {
		person_id: person.id,
		fact_type: "birthday",
		fact_value: "x",
	});
	await insert(sb, "person_interactions", { person_id: person.id, interaction_type: "call" });
	const note = await insert(sb, "notes", { body: "Roof plan", title: "Roof plan" });
	const other = await insert(sb, "notes", { body: "See [[Roof plan]]", needs_review: true });
	const event = await insert(sb, "calendar_events", {
		title: "Roofer",
		start_at: `${TODAY}T13:00:00Z`,
		end_at: `${TODAY}T14:00:00Z`,
	});
	await insert(sb, "note_links", {
		note_id: other.id,
		target_type: "note",
		kind: "wikilink",
		target_note_id: note.id,
	});
	await insert(sb, "note_links", {
		note_id: note.id,
		target_type: "task",
		kind: "manual",
		target_task_id: filed.id,
	});
	await insert(sb, "note_links", {
		note_id: note.id,
		target_type: "event",
		kind: "manual",
		target_event_id: event.id,
	});
	const routine = await insert(sb, "routines", { name: "Stretch" });
	await insert(sb, "routine_completions", { routine_id: routine.id, completed_date: TODAY });
	await insert(sb, "quotes", { text: "Measure twice." });
	await insert(sb, "journal_entries", { entry_date: TODAY });
	await insert(sb, "ingest_links", { url: "https://example.com" });
	await insert(sb, "notifications", { type: "capture", title: "Captured" });
	return { personId: person.id, projectId: project.id, noteId: note.id };
}

const SINCE_UTC = `${TODAY}T00:00:00Z`;

const INVOCATIONS: Record<string, () => Promise<unknown>> = {
	getCachedDomains: () => domains.getCachedDomains(true),
	getCachedDomainBoard: () => domains.getCachedDomainBoard(TODAY, TZ),
	getCachedInbox: () => inbox.getCachedInbox(),
	getCachedJournal: () => journal.getCachedJournal(),
	getCachedLinks: () => links.getCachedLinks(),
	getCachedNoteLists: () => notes.getCachedNoteLists(),
	getCachedNoteEditorContext: () => notes.getCachedNoteEditorContext(),
	getCachedNoteLinks: () => notes.getCachedNoteLinks(seeded.noteId),
	getCachedNotifications: () => notifications.getCachedNotifications(),
	getCachedPeople: () => people.getCachedPeople(),
	getCachedPerson: () => people.getCachedPerson(seeded.personId),
	getCachedProjectBoard: () => projects.getCachedProjectBoard(),
	getCachedProject: () => projects.getCachedProject(seeded.projectId),
	getCachedQuotes: () => quotes.getCachedQuotes(),
	getCachedRoutines: () => routines.getCachedRoutines("2026-09-01"),
	getCachedAppTimezone: () => settings.getCachedAppTimezone(),
	getCachedReminderSettings: () => settings.getCachedReminderSettings(),
	getCachedTaskBoard: () => tasks.getCachedTaskBoard(SINCE_UTC),
	getCachedTaskFormOptions: () => tasks.getCachedTaskFormOptions(),
	getCachedTodayDigest: () => today.getCachedTodayDigest(TODAY),
};

const DECLS: Record<string, ReaderDecl> = {
	...domains.readers,
	...inbox.readers,
	...journal.readers,
	...links.readers,
	...notes.readers,
	...notifications.readers,
	...people.readers,
	...projects.readers,
	...quotes.readers,
	...routines.readers,
	...settings.readers,
	...tasks.readers,
	...today.readers,
};

describe("a cached reader declares exactly the tables it reads", () => {
	beforeEach(async () => {
		seeded = await seed();
		touched.clear();
		rpcCalls = [];
	});

	it("covers every declared reader", () => {
		expect(Object.keys(INVOCATIONS).sort()).toEqual(Object.keys(DECLS).sort());
	});

	it.each(Object.keys(DECLS))("%s", async (name) => {
		await INVOCATIONS[name]();
		expect(rpcCalls).toEqual([]);
		expect([...touched].sort()).toEqual([...DECLS[name].tables].sort());
	});
});
