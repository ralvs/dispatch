import type { McpServer } from "@modelcontextprotocol/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/invalidate";
import { displayTitle } from "@/lib/note-display";
import { listDomains } from "@/lib/services/domains";
import {
	createNote,
	getNote,
	listNotes,
	type NoteListRow,
	resyncNoteGraph,
	updateNote,
} from "@/lib/services/notes";
import { recordNotification } from "@/lib/services/notifications";
import { todayForRequest } from "@/lib/services/settings";
import { registerTextTool, ToolError } from "../contract";
import { resolveDomain, UNFILED } from "../resolve";

// The owner's notes, as an assistant sees them (docs/adr/0079): read, create,
// edit. Pinning and deleting stay in the app. Domains are named, not
// referenced by id (../resolve.ts).

async function domainNames(sb: SupabaseClient): Promise<Map<string, string>> {
	return new Map((await listDomains(sb)).map((d) => [d.id, d.name]));
}

/** What list_notes shows of a note: enough to pick one and act on it. */
function toListItem(row: NoteListRow, domains: Map<string, string>) {
	return {
		id: row.id,
		title: displayTitle(row),
		domain: row.domain_id ? (domains.get(row.domain_id) ?? null) : null,
		pinned: row.pinned_at !== null,
		needs_review: row.needs_review,
	};
}

async function toDetail(sb: SupabaseClient, row: NoteListRow) {
	const domains = await domainNames(sb);
	return { ...row, domain: row.domain_id ? (domains.get(row.domain_id) ?? null) : null };
}

async function mustGetNote(sb: SupabaseClient, id: string): Promise<NoteListRow> {
	const row = await getNote(sb, id);
	if (!row) throw new ToolError("No note with that id.");
	return row;
}

/** Iron rule #6: the assistant's edit lands in the ledger with what undo needs. */
async function recordUpdate(
	sb: SupabaseClient,
	id: string,
	prev: Record<string, string | null>,
	label: string,
): Promise<void> {
	await recordNotification(sb, {
		type: "mcp.note.updated",
		title: "Assistant updated a note",
		body: label,
		source_ref: id,
		undo_payload: { table: "notes", id, prev },
	});
	afterExternalMutation(...EXTERNAL_WRITES.mcpNotes);
}

export function registerNoteTools(server: McpServer, sb: SupabaseClient): void {
	registerTextTool(
		server,
		"list_notes",
		{
			title: "List notes",
			description:
				'The owner\'s notes, pinned first, then newest. query matches a title, or the body of an untitled note. Filter by domain (name or id; "inbox" means unfiled) or pinned.',
			inputSchema: z.object({
				query: z.string().min(1).optional().describe("Text to search for."),
				domain: z.string().min(1).optional().describe('Domain name or id, or "inbox".'),
				pinned: z.boolean().optional(),
				limit: z.number().int().min(1).max(200).default(50).describe("At most this many notes."),
			}),
			annotations: { readOnlyHint: true },
		},
		async ({ query, domain, pinned, limit }) => {
			const resolved = domain ? await resolveDomain(sb, domain) : undefined;
			const rows = await listNotes(sb, {
				query,
				domainId: resolved === undefined ? undefined : resolved === UNFILED ? null : resolved.id,
				pinned,
				limit,
			});
			const domains = await domainNames(sb);
			return rows.map((row) => toListItem(row, domains));
		},
	);

	registerTextTool(
		server,
		"get_note",
		{
			title: "Get a note",
			description: "One note in full, by its id from list_notes, with its body.",
			inputSchema: z.object({ id: z.uuid().describe("The note's id.") }),
			annotations: { readOnlyHint: true },
		},
		async ({ id }) => toDetail(sb, await mustGetNote(sb, id)),
	);

	registerTextTool(
		server,
		"create_note",
		{
			title: "Create a note",
			description:
				"Add a note. Without a domain it lands in the inbox. Write it in the language it was given in.",
			inputSchema: z.object({
				body: z.string().min(1),
				title: z.string().trim().min(1).optional(),
				domain: z.string().min(1).optional().describe('Domain name or id, or "inbox".'),
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
		},
		async ({ body, title, domain }) => {
			const resolved = domain ? await resolveDomain(sb, domain) : UNFILED;
			const created = await createNote(sb, {
				body,
				title: title ?? null,
				domain_id: resolved === UNFILED ? null : resolved.id,
				source_type: "own_thought",
			});
			// Iron rule #6: the assistant's write lands in the ledger, and so pushes.
			await recordNotification(sb, {
				type: "mcp.note.created",
				title: "Assistant created a note",
				body: displayTitle(created),
				source_ref: created.id,
			});
			afterExternalMutation(...EXTERNAL_WRITES.mcpNotes);
			return toDetail(sb, await mustGetNote(sb, created.id));
		},
	);

	registerTextTool(
		server,
		"update_note",
		{
			title: "Update a note",
			description:
				"Edit a note by id. null clears title or domain. append adds a line (dated YYYY-MM-DD unless dated is false) and is the safe edit; body overwrites the whole note. Not both.",
			inputSchema: z.object({
				id: z.uuid().describe("The note's id."),
				title: z.string().trim().min(1).nullable().optional().describe("Or null to clear."),
				body: z.string().min(1).optional().describe("The whole body."),
				append: z.string().min(1).optional().describe("One line added to the body."),
				dated: z.boolean().default(true).describe("Prefix an appended line with today's date."),
				domain: z.string().min(1).nullable().optional().describe("Name or id, or null."),
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
		},
		async ({ id, title, body, append, dated, domain }) => {
			if (body !== undefined && append !== undefined) {
				throw new ToolError("Send body or append, not both.");
			}
			const patch: Parameters<typeof updateNote>[2] = {};
			if (title !== undefined) patch.title = title;
			if (body !== undefined) patch.body = body;
			if (domain !== undefined) {
				const resolved = domain === null ? UNFILED : await resolveDomain(sb, domain);
				patch.domain_id = resolved === UNFILED ? null : resolved.id;
			}
			if (Object.keys(patch).length === 0 && append === undefined) {
				throw new ToolError("Nothing to change: send at least one field.");
			}

			// The previous values are what the ledger's undo replays: only the
			// fields this call writes, from the pre-read or the append's old body.
			const before = await mustGetNote(sb, id);
			const prev: Record<string, string | null> = {};
			if ("title" in patch) prev.title = before.title;
			if ("domain_id" in patch) prev.domain_id = before.domain_id;
			if ("body" in patch) prev.body = before.body;
			let savedBody: string | null = null;
			let after: NoteListRow;

			try {
				if (append !== undefined) {
					const line = dated ? `${await todayForRequest(sb)} — ${append}` : append;
					// One UPDATE, so two appends at once both survive, and it hands back
					// the body it replaced, so the undo snapshot cannot race (the migration).
					const { data, error } = await sb.rpc("note_body_append", {
						p_note_id: id,
						p_line: line,
					});
					if (error) {
						console.error("note_body_append failed", error);
						throw new ToolError("Could not append to the note.");
					}
					const row = (data as { old_body: string; new_body: string }[] | null)?.[0];
					if (!row) throw new ToolError("No note with that id.");
					prev.body = row.old_body;
					savedBody = row.new_body;
				}

				// updateNote re-derives the graph when body moves; body and append are
				// exclusive, so an append re-syncs here once from the saved body.
				if (Object.keys(patch).length > 0) await updateNote(sb, id, patch);
				if (savedBody !== null) await resyncNoteGraph(sb, id);
				after = await mustGetNote(sb, id);
			} catch (err) {
				// The append landed but a later step failed: re-sync the graph from the
				// saved body if we can, then the ledger still owes the owner a row for
				// the append, then the error goes on.
				if (savedBody !== null) {
					try {
						await resyncNoteGraph(sb, id);
					} catch (syncErr) {
						console.error("resyncNoteGraph after failed update_note", syncErr);
					}
					await recordUpdate(sb, id, prev, displayTitle({ ...before, body: savedBody }));
				}
				throw err;
			}

			await recordUpdate(sb, id, prev, displayTitle(after));
			return toDetail(sb, after);
		},
	);
}
