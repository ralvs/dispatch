import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/invalidate";
import { displayTitle } from "@/lib/note-display";
import { listDomains } from "@/lib/services/domains";
import { AppendRefusedError, PartialWriteError } from "@/lib/services/errors";
import {
	createNote,
	getNote,
	listNotes,
	type NoteListRow,
	type NotePatch,
	updateNote,
} from "@/lib/services/notes";
import { recordNotification } from "@/lib/services/notifications";
import { todayForRequest } from "@/lib/services/settings";
import type { SupabaseClient } from "@/lib/supabase/types";
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

/** Iron rule #6: the assistant's edit lands in the ledger, and so pushes. */
async function recordUpdate(sb: SupabaseClient, id: string, label: string): Promise<void> {
	await recordNotification(sb, {
		type: "mcp.note.updated",
		title: "Assistant updated a note",
		body: label,
		source_ref: id,
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
			const patch: NotePatch = {};
			if (title !== undefined) patch.title = title;
			if (body !== undefined) patch.body = body;
			if (domain !== undefined) {
				const resolved = domain === null ? UNFILED : await resolveDomain(sb, domain);
				patch.domain_id = resolved === UNFILED ? null : resolved.id;
			}
			if (append !== undefined) {
				patch.body_append = dated ? `${await todayForRequest(sb)} — ${append}` : append;
			}
			if (Object.keys(patch).length === 0) {
				throw new ToolError("Nothing to change: send at least one field.");
			}

			await mustGetNote(sb, id);
			try {
				await updateNote(sb, id, patch);
			} catch (err) {
				if (err instanceof AppendRefusedError) throw new ToolError(err.message);
				// The append landed before the failure: the ledger still owes the
				// owner its row, even when the title can't be read back.
				if (err instanceof PartialWriteError) {
					const row = await getNote(sb, id).catch((readErr: unknown) => {
						console.error("[mcp] update_note re-read after a partial write", readErr);
						return null;
					});
					await recordUpdate(sb, id, row ? displayTitle(row) : "A note");
				}
				throw err;
			}
			const after = await mustGetNote(sb, id);
			await recordUpdate(sb, id, displayTitle(after));
			return toDetail(sb, after);
		},
	);
}
