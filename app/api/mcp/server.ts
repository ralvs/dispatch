import { McpServer } from "@modelcontextprotocol/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerLinkTools } from "./tools/links";
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
	return server;
}
