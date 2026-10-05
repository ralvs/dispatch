import type { McpServer } from "@modelcontextprotocol/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/invalidate";
import { type LinkRow, listLinks, setLinkStatus } from "@/lib/services/links";
import { recordNotification } from "@/lib/services/notifications";
import { registerTextTool, ToolError } from "../contract";

// The reading list at /links, as an assistant sees it (docs/adr/0079). Saving
// a link stays with /api/capture; an assistant reads the list and marks what
// it has read, nothing more.

/** What a tool shows of a link: enough to open it and to name it. */
function toTool(row: LinkRow) {
	return {
		id: row.id,
		url: row.url,
		title: row.title,
		status: row.status,
		saved_at: row.created_at,
	};
}

function hostname(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

export function registerLinkTools(server: McpServer, sb: SupabaseClient): void {
	registerTextTool(
		server,
		"list_links",
		{
			title: "List saved links",
			description:
				"The owner's saved-link reading list, newest first. Set unread_only to see only what is still unread.",
			inputSchema: z.object({
				unread_only: z.boolean().optional().describe("Only links not yet read."),
				limit: z.number().int().min(1).max(200).default(50).describe("At most this many links."),
			}),
			annotations: { readOnlyHint: true },
		},
		async ({ unread_only, limit }) => {
			const rows = await listLinks(sb, { status: unread_only ? "unread" : undefined, limit });
			return rows.map(toTool);
		},
	);

	registerTextTool(
		server,
		"mark_link_read",
		{
			title: "Mark a link read",
			description: "Mark one saved link as read, by its id from list_links.",
			inputSchema: z.object({ id: z.uuid().describe("The link's id.") }),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
		},
		async ({ id }) => {
			// The previous status is what the ledger's undo replays.
			const { data: before, error } = await sb
				.from("ingest_links")
				.select("status")
				.eq("id", id)
				.maybeSingle();
			if (error) throw new Error(error.message);
			if (!before) throw new ToolError("No saved link with that id.");
			const row = await setLinkStatus(sb, id, "read");
			if (!row) throw new ToolError("No saved link with that id.");
			// Iron rule #6: the assistant's write lands in the ledger, and so pushes.
			await recordNotification(sb, {
				type: "mcp.link.read",
				title: "Assistant marked a link read",
				body: row.title ?? hostname(row.url),
				source_ref: row.id,
				source_url: row.url,
				undo_payload: { table: "ingest_links", id: row.id, prev: { status: before.status } },
			});
			afterExternalMutation(...EXTERNAL_WRITES.mcpLinks);
			return toTool(row);
		},
	);
}
