// ─────────────────────────────────────────────────────────────────────────
// The strings the MCP endpoint and its discovery document must agree on
// exactly (docs/adr/0079). RFC 9728 clients compare the `resource` they
// discovered against the URL they connected to, and reject a mismatch.
// Ported from ralvs/echo (its ADR-0023), where the same shape already works
// with Claude on the web, the desktop and the phone.
// ─────────────────────────────────────────────────────────────────────────

/** Where the MCP endpoint is served, relative to the app root. */
export const MCP_PATH = "/api/mcp";

/** Where the discovery document answers (see the rewrites in next.config.ts). */
export const PRM_PATH = "/.well-known/oauth-protected-resource";

/**
 * The origin the client used. Read from the forwarded headers rather than an
 * env var, so one build serves the vercel.app URL and the custom domain alike.
 * Vercel terminates TLS before the function, so `request.url` is not the
 * address the client typed and x-forwarded-* is.
 */
export function originOf(request: Request): string {
	const host =
		request.headers.get("x-forwarded-host") ??
		request.headers.get("host") ??
		new URL(request.url).host;
	const raw =
		request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
	// Only a web scheme may reach the discovery URL; anything else is a forged header.
	const proto = raw === "http" || raw === "https" ? raw : "https";
	return `${proto}://${host}`;
}

/** The `WWW-Authenticate` challenge that points a client at the discovery document. */
export function bearerChallenge(origin: string): string {
	return `Bearer resource_metadata="${origin}${PRM_PATH}"`;
}

/**
 * CORS for every MCP-facing route. Browser clients (Claude on the web and the
 * phone) cannot connect without it; native ones never send a preflight.
 *
 * Origin "*" is safe and must stay uncredentialed: auth is a bearer token the
 * client holds, never a cookie. Credentials would void the wildcard and start
 * honouring the app's own session cookies on this origin, which is exactly
 * what the endpoint must not do.
 *
 * WWW-Authenticate is exposed because it carries the discovery hint, and
 * browsers hide unlisted response headers from client code.
 */
export const MCP_CORS: Readonly<Record<string, string>> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
	"Access-Control-Allow-Headers":
		"authorization,content-type,accept,mcp-protocol-version,mcp-session-id,last-event-id",
	"Access-Control-Expose-Headers": "WWW-Authenticate,mcp-session-id",
	"Access-Control-Max-Age": "86400",
};
