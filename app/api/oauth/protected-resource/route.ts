import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { MCP_CORS, MCP_PATH, originOf } from "@/lib/mcp-origin";

// ─────────────────────────────────────────────────────────────────────────
// RFC 9728 protected-resource metadata for the MCP endpoint (docs/adr/0079),
// served at /.well-known/oauth-protected-resource through the rewrites in
// next.config.ts. It names the resource and the authorization server that
// issues tokens for it: Supabase Auth's OAuth 2.1 server.
//
// Unauthenticated by design, the one exception to iron rule #2 that is not a
// secret-authed external surface: a client reads it before it holds any
// token, because this is how it learns where to get one. It discloses only
// public URLs.
// ─────────────────────────────────────────────────────────────────────────

export function GET(request: Request): Response {
	const supabaseUrl = env().NEXT_PUBLIC_SUPABASE_URL;
	if (!supabaseUrl) {
		return NextResponse.json({ error: "Not configured" }, { status: 503, headers: MCP_CORS });
	}
	return NextResponse.json(
		{
			resource: `${originOf(request)}${MCP_PATH}`,
			authorization_servers: [`${supabaseUrl.replace(/\/$/, "")}/auth/v1`],
			scopes_supported: ["openid"],
			bearer_methods_supported: ["header"],
		},
		{ headers: MCP_CORS },
	);
}

export function OPTIONS(): Response {
	return new Response(null, { status: 204, headers: MCP_CORS });
}
