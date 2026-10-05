import { expect, test } from "@playwright/test";

/**
 * The MCP surface answers before any token exists (docs/adr/0079): the
 * discovery document at the root in both spellings clients probe, the
 * endpoint's challenge, and the consent page signed out. Each one breaks
 * silently if proxy.ts or the rewrites in next.config.ts lose it.
 */
test.use({ storageState: { cookies: [], origins: [] } });

for (const path of [
	"/.well-known/oauth-protected-resource",
	"/.well-known/oauth-protected-resource/api/mcp",
]) {
	test(`${path} serves the protected-resource metadata`, async ({ request }) => {
		const res = await request.get(path, { maxRedirects: 0 });
		expect(res.status()).toBe(200);
		const json = await res.json();
		expect(json.resource).toMatch(/\/api\/mcp$/);
		expect(json.authorization_servers[0]).toMatch(/\/auth\/v1$/);
	});
}

test("POST /api/mcp without a token is challenged toward discovery", async ({ request }) => {
	const res = await request.post("/api/mcp", {
		data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
		headers: { accept: "application/json, text/event-stream" },
		maxRedirects: 0,
	});
	expect(res.status()).toBe(401);
	expect(res.headers()["www-authenticate"]).toContain("resource_metadata");
});

test("/oauth/consent renders signed out instead of redirecting", async ({ request }) => {
	const res = await request.get("/oauth/consent?authorization_id=x", { maxRedirects: 0 });
	expect(res.status()).toBe(200);
});
