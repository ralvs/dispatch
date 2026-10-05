import { describe, expect, it, vi } from "vitest";

// Cache invalidation needs a Next request scope; there is none in a test.
vi.mock("@/lib/invalidate", async (original) => ({
	...(await original<typeof import("@/lib/invalidate")>()),
	afterExternalMutation: vi.fn(),
}));

import { POST } from "@/app/api/mcp/route";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/invalidate";
import { anonClient, ownerClient, serviceClient } from "@/test/integration/clients";

// POST /api/mcp end to end against the local database: the bearer boundary
// (iron rule #2), then the link tools acting as the owner through RLS.

async function ownerToken(): Promise<string> {
	const { data } = await (await ownerClient()).auth.getSession();
	if (!data.session) throw new Error("owner has no session");
	return data.session.access_token;
}

let nextId = 1;
function rpc(method: string, params: unknown, token?: string) {
	return POST(
		new Request("http://localhost/api/mcp", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
				...(token ? { authorization: `Bearer ${token}` } : {}),
			},
			body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
		}),
	);
}

/** The JSON-RPC message, from a JSON body or the one-event SSE body the
 * 2025-era stateless path answers with. */
async function message(res: Response) {
	const body = await res.text();
	if (!res.headers.get("content-type")?.includes("text/event-stream")) return JSON.parse(body);
	const data = body.split("\n").find((l) => l.startsWith("data: "));
	if (!data) throw new Error(`no data line in ${body}`);
	return JSON.parse(data.slice("data: ".length));
}

async function callTool(token: string, name: string, args: unknown) {
	const res = await rpc("tools/call", { name, arguments: args }, token);
	expect(res.status).toBe(200);
	const json = await message(res);
	return json.result as { content: { text: string }[]; isError?: boolean };
}

async function seedLinks() {
	const sb = serviceClient();
	const { data, error } = await sb
		.from("ingest_links")
		.insert([
			{ url: "https://example.com/unread", title: "Unread one", status: "unread" },
			{ url: "https://example.com/read", title: "Read one", status: "read" },
		])
		.select("id, status");
	if (error) throw error;
	return data;
}

describe("POST /api/mcp", () => {
	it("answers 401 with the discovery challenge when no token is sent", async () => {
		const res = await rpc("tools/list", {});
		expect(res.status).toBe(401);
		expect(res.headers.get("WWW-Authenticate")).toContain("resource_metadata=");
	});

	it("answers 401 to a garbage token", async () => {
		const res = await rpc("tools/list", {}, "not-a-jwt");
		expect(res.status).toBe(401);
	});

	it("answers 401 with the challenge to a signed-in user who is not the owner", async () => {
		const admin = serviceClient();
		const email = `stranger-${Date.now()}@example.com`;
		const password = "stranger-password-1";
		const { data: created, error } = await admin.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
		});
		if (error) throw error;
		try {
			const sb = anonClient();
			const { data, error: signInError } = await sb.auth.signInWithPassword({ email, password });
			if (signInError || !data.session) throw signInError ?? new Error("no session");
			const res = await rpc("tools/list", {}, data.session.access_token);
			expect(res.status).toBe(401);
			expect(res.headers.get("WWW-Authenticate")).toContain("resource_metadata=");
		} finally {
			await admin.auth.admin.deleteUser(created.user.id);
		}
	});

	it("answers 401 to the owner's session sent as a cookie, without a bearer", async () => {
		const token = await ownerToken();
		const res = await POST(
			new Request("http://localhost/api/mcp", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					accept: "application/json, text/event-stream",
					cookie: `sb-127-auth-token=${encodeURIComponent(JSON.stringify({ access_token: token }))}; sb-access-token=${token}`,
				},
				body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method: "tools/list", params: {} }),
			}),
		);
		expect(res.status).toBe(401);
	});

	it("initializes and lists the link tools", async () => {
		const token = await ownerToken();
		const init = await rpc(
			"initialize",
			{
				protocolVersion: "2025-06-18",
				capabilities: {},
				clientInfo: { name: "test", version: "1" },
			},
			token,
		);
		expect(init.status).toBe(200);
		expect((await message(init)).result.serverInfo.name).toBe("dispatch");

		const list = await rpc("tools/list", {}, token);
		expect(list.status).toBe(200);
		const names = (await message(list)).result.tools.map((t: { name: string }) => t.name);
		expect(names).toEqual(expect.arrayContaining(["list_links", "mark_link_read"]));
	});

	it("list_links narrows to unread", async () => {
		await seedLinks();
		const token = await ownerToken();
		const result = await callTool(token, "list_links", { unread_only: true });
		expect(result.isError).toBeFalsy();
		const links = JSON.parse(result.content[0].text);
		expect(links).toHaveLength(1);
		expect(links[0]).toMatchObject({
			url: "https://example.com/unread",
			title: "Unread one",
			status: "unread",
		});
		expect(Object.keys(links[0]).sort()).toEqual(["id", "saved_at", "status", "title", "url"]);
	});

	it("mark_link_read flips the status and writes a ledger row", async () => {
		const [unread] = await seedLinks();
		const token = await ownerToken();
		const result = await callTool(token, "mark_link_read", { id: unread.id });
		expect(result.isError).toBeFalsy();
		expect(JSON.parse(result.content[0].text)).toMatchObject({ id: unread.id, status: "read" });
		expect(afterExternalMutation).toHaveBeenCalledWith(...EXTERNAL_WRITES.mcpLinks);

		const sb = serviceClient();
		const { data: link } = await sb
			.from("ingest_links")
			.select("status")
			.eq("id", unread.id)
			.single();
		expect(link?.status).toBe("read");
		const { data: rows } = await sb
			.from("notifications")
			.select("type, source_ref, undo_payload")
			.eq("type", "mcp.link.read");
		expect(rows).toEqual([
			{
				type: "mcp.link.read",
				source_ref: unread.id,
				undo_payload: { table: "ingest_links", id: unread.id, prev: { status: "unread" } },
			},
		]);
	});

	it("mark_link_read names a missing id as a tool error", async () => {
		const token = await ownerToken();
		const result = await callTool(token, "mark_link_read", {
			id: "00000000-0000-4000-8000-000000000000",
		});
		expect(result).toMatchObject({
			isError: true,
			content: [{ text: "No saved link with that id." }],
		});
	});
});
