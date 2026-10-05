import { createMcpHandler } from "@modelcontextprotocol/server";
import { requireOwnerBearer } from "@/lib/auth";
import { MCP_CORS } from "@/lib/mcp-origin";
import { createServer } from "./server";

// ─────────────────────────────────────────────────────────────────────────
// The MCP endpoint (docs/adr/0079): Dispatch's tools for an assistant such
// as Claude, served from the app itself so a tool call is one hop to the
// services, not a proxy in front of another deployment.
//
// The boundary is requireOwnerBearer(), never requireOwner() (iron rule #2).
// This route never reads cookies: an MCP client authenticates with the OAuth
// access token Supabase issued it after the owner approved it on
// /oauth/consent, and a browser that happens to hold a Dispatch session must
// not authorize a call it did not present a token for. proxy.ts keeps this
// path out of its matcher for the same reason.
//
// Stateless: a fresh server per request, closed over the owner's RLS client
// (iron rule #3). JSON responses, no SSE stream; GET and DELETE answer 405
// from the SDK, which is what a stateless server says.
// ─────────────────────────────────────────────────────────────────────────

async function handle(request: Request): Promise<Response> {
	const auth = await requireOwnerBearer(request);
	if (auth instanceof Response) return auth;
	const handler = createMcpHandler(() => createServer(auth.sb), { responseMode: "json" });
	const res = await handler.fetch(request);
	const headers = new Headers(res.headers);
	for (const [k, v] of Object.entries(MCP_CORS)) headers.set(k, v);
	return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;

export function OPTIONS(): Response {
	return new Response(null, { status: 204, headers: MCP_CORS });
}
