import { McpServer } from "@modelcontextprotocol/server";
import { isPluggyConfigured } from "@/lib/env";
import type { SupabaseClient } from "@/lib/supabase/types";
import { registerEventTools } from "./tools/events";
import { registerFinanceTools } from "./tools/finance";
import { registerLinkTools } from "./tools/links";
import { registerNoteTools } from "./tools/notes";
import { registerTaskTools } from "./tools/tasks";

/**
 * One MCP server per request, closed over the owner's RLS client (iron rule
 * #3): every tool acts as the owner, through the same services the pages use.
 * Built per request because the endpoint is stateless (docs/adr/0079).
 */
export function createServer(sb: SupabaseClient): McpServer {
	const server = new McpServer({ name: "dispatch", version: "1.0.0" });
	registerLinkTools(server, sb);
	registerTaskTools(server, sb);
	registerNoteTools(server, sb);
	registerEventTools(server, sb);
	// Read-only finance through Meu Pluggy, only where it is set up (docs/adr/0096).
	if (isPluggyConfigured()) registerFinanceTools(server, sb);
	return server;
}
