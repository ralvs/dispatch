import { describe, expect, it, vi } from "vitest";

// Cache invalidation needs a Next request scope; there is none in a test.
vi.mock("@/lib/invalidate", async (original) => ({
	...(await original<typeof import("@/lib/invalidate")>()),
	afterExternalMutation: vi.fn(),
}));

// A graph sync that fails once drives a write past its append (PartialWriteError).
vi.mock("@/lib/services/mentions", async (original) => {
	const real = await original<typeof import("@/lib/services/mentions")>();
	return { ...real, syncNoteMentionsFromText: vi.fn(real.syncNoteMentionsFromText) };
});

import { POST } from "@/app/api/mcp/route";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/invalidate";
import { listDomains } from "@/lib/services/domains";
import { syncNoteMentionsFromText } from "@/lib/services/mentions";
import { createNote, setPin } from "@/lib/services/notes";
import { createPerson } from "@/lib/services/people";
import { todayForRequest } from "@/lib/services/settings";
import { anonClient, ownerClient, serviceClient } from "@/test/integration/clients";

// The note tools through POST /api/mcp, as the owner, against the local
// database (docs/adr/0079).

let nextId = 1;
async function call(name: string, args: unknown) {
	const { data } = await (await ownerClient()).auth.getSession();
	if (!data.session) throw new Error("owner has no session");
	const res = await POST(
		new Request("http://localhost/api/mcp", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
				authorization: `Bearer ${data.session.access_token}`,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: nextId++,
				method: "tools/call",
				params: { name, arguments: args },
			}),
		}),
	);
	expect(res.status).toBe(200);
	const body = await res.text();
	const line = res.headers.get("content-type")?.includes("text/event-stream")
		? (body.split("\n").find((l) => l.startsWith("data: ")) ?? "").slice("data: ".length)
		: body;
	const result = JSON.parse(line).result as { content: { text: string }[]; isError?: boolean };
	return {
		isError: Boolean(result.isError),
		text: result.content[0].text,
		json: () => JSON.parse(result.content[0].text),
	};
}

async function seed() {
	const sb = await ownerClient();
	const [domainA, domainB] = await listDomains(sb);
	const titled = await createNote(sb, {
		title: "Garden plan",
		body: "tomatoes",
		domain_id: domainA.id,
	});
	const untitled = await createNote(sb, { body: "Shed roof leaks\nfix soon" });
	const hidden = await createNote(sb, {
		title: "Other",
		body: "garden in body only",
		domain_id: domainB.id,
	});
	await setPin(sb, untitled.id, true);
	return { sb, domainA, domainB, titled, untitled, hidden };
}

async function ledger(type: string) {
	const { data } = await serviceClient()
		.from("notifications")
		.select("type, source_ref")
		.eq("type", type);
	return data ?? [];
}

describe("MCP note tools", () => {
	it("list_notes searches titles and untitled bodies, and filters by domain, inbox, pinned and limit", async () => {
		const { domainA, titled, untitled, hidden } = await seed();
		const ids = async (args: unknown) =>
			((await call("list_notes", args)).json() as { id: string }[]).map((n) => n.id);
		expect(await ids({ query: "garden" })).toEqual([titled.id]);
		const shed = (await call("list_notes", { query: "roof" })).json();
		expect(shed).toEqual([
			{
				id: untitled.id,
				title: "Shed roof leaks",
				domain: null,
				pinned: true,
				needs_review: false,
			},
		]);
		expect(await ids({ query: "%" })).toEqual([]);
		expect(await ids({ domain: domainA.name })).toEqual([titled.id]);
		// The schema seeds an unfiled welcome note, so the inbox holds more than ours.
		const inbox = await ids({ domain: "inbox" });
		expect(inbox).toContain(untitled.id);
		expect(inbox).not.toContain(titled.id);
		expect(await ids({ pinned: true })).toEqual([untitled.id]);
		const unpinned = await ids({ pinned: false });
		expect(unpinned).toEqual(expect.arrayContaining([titled.id, hidden.id]));
		expect(unpinned).not.toContain(untitled.id);
		expect(await ids({ limit: 1 })).toHaveLength(1);
	});

	it("get_note returns the body and domain name, and names a missing id", async () => {
		const { domainA, titled } = await seed();
		expect((await call("get_note", { id: titled.id })).json()).toMatchObject({
			body: "tomatoes",
			domain: domainA.name,
		});
		expect(await call("get_note", { id: crypto.randomUUID() })).toMatchObject({
			isError: true,
			text: "No note with that id.",
		});
	});

	it("create_note files it in a domain and writes a ledger row", async () => {
		const { domainB } = await seed();
		const note = (await call("create_note", { body: "Ideia nova", domain: domainB.name })).json();
		expect(note).toMatchObject({
			body: "Ideia nova",
			domain: domainB.name,
			source_type: "own_thought",
		});
		expect(await ledger("mcp.note.created")).toEqual([
			{ type: "mcp.note.created", source_ref: note.id },
		]);
		expect(afterExternalMutation).toHaveBeenCalledWith(...EXTERNAL_WRITES.mcpNotes);
	});

	it("update_note edits title and domain and records it", async () => {
		const { titled } = await seed();
		const result = await call("update_note", { id: titled.id, title: null, domain: null });
		expect(result.json()).toMatchObject({ title: null, domain_id: null, domain: null });
		expect(await ledger("mcp.note.updated")).toEqual([
			{ type: "mcp.note.updated", source_ref: titled.id },
		]);
	});

	it("update_note refuses body with append, and an empty patch", async () => {
		const { titled } = await seed();
		expect(await call("update_note", { id: titled.id, body: "x", append: "y" })).toMatchObject({
			isError: true,
			text: "Send body or append, not both.",
		});
		expect(await call("update_note", { id: titled.id })).toMatchObject({ isError: true });
	});

	it("update_note appends atomically, dated, with a ledger row each", async () => {
		const { sb, titled } = await seed();
		const today = await todayForRequest(sb);
		const [a, b] = await Promise.all([
			call("update_note", { id: titled.id, append: "one" }),
			call("update_note", { id: titled.id, append: "two", dated: false }),
		]);
		expect(a.isError || b.isError).toBe(false);
		const body = (await call("get_note", { id: titled.id })).json().body as string;
		expect(body.split("\n").sort()).toEqual([`${today} — one`, "tomatoes", "two"].sort());
		expect(await ledger("mcp.note.updated")).toHaveLength(2);
	});

	it("update_note append syncs a mention and a wikilink", async () => {
		const { sb, titled, untitled } = await seed();
		const ana = await createPerson(sb, { name: "Ana" });
		await call("update_note", {
			id: titled.id,
			append: `ask @Ana about [[${untitled.id}|Shed]]`,
			dated: false,
		});
		const { data: mentions } = await serviceClient()
			.from("mentions")
			.select("person_id")
			.eq("note_id", titled.id);
		expect(mentions).toEqual([{ person_id: ana.id }]);
		const { data: links } = await serviceClient()
			.from("note_links")
			.select("target_note_id")
			.eq("note_id", titled.id)
			.eq("kind", "wikilink");
		expect(links).toEqual([{ target_note_id: untitled.id }]);
	});

	it("list_notes matches punctuation and wildcards literally", async () => {
		const sb = await ownerClient();
		const odd = await createNote(sb, { title: 'odd a,b(c)"\\ here', body: "x" });
		const pct = await createNote(sb, { title: "50% off", body: "x" });
		await createNote(sb, { title: "50 off", body: "x" });
		const under = await createNote(sb, { title: "a_b", body: "x" });
		await createNote(sb, { title: "axb", body: "x" });
		const ids = async (query: string) => {
			const result = await call("list_notes", { query });
			expect(result.isError).toBe(false);
			return (result.json() as { id: string }[]).map((n) => n.id);
		};
		expect(await ids('a,b(c)"\\')).toEqual([odd.id]);
		expect(await ids("50%")).toEqual([pct.id]);
		expect(await ids("a_b")).toEqual([under.id]);
	});

	it("update_note with only a title records it, and busts", async () => {
		const { titled } = await seed();
		vi.mocked(afterExternalMutation).mockClear();
		await call("update_note", { id: titled.id, title: "Veg plan" });
		expect(await ledger("mcp.note.updated")).toHaveLength(1);
		expect(afterExternalMutation).toHaveBeenCalledWith(...EXTERNAL_WRITES.mcpNotes);
	});

	it("update_note resolves a domain given by id", async () => {
		const { titled, domainB } = await seed();
		const result = await call("update_note", { id: titled.id, domain: domainB.id });
		expect(result.json()).toMatchObject({ domain_id: domainB.id, domain: domainB.name });
		expect(await ledger("mcp.note.updated")).toHaveLength(1);
	});

	it("update_note body overwrite stores a new wikilink", async () => {
		const { titled, untitled } = await seed();
		await call("update_note", { id: titled.id, body: `see [[${untitled.id}|Shed]]` });
		const { data: links } = await serviceClient()
			.from("note_links")
			.select("target_note_id")
			.eq("note_id", titled.id)
			.eq("kind", "wikilink");
		expect(links).toEqual([{ target_note_id: untitled.id }]);
		expect(await ledger("mcp.note.updated")).toHaveLength(1);
	});

	it("note_body_append is closed to anon", async () => {
		const { titled } = await seed();
		const { error } = await anonClient().rpc("note_body_append", {
			p_note_id: titled.id,
			p_line: "x",
		});
		expect(error).not.toBeNull();
	});

	it("update_note records an append that landed before a later step failed", async () => {
		const { titled } = await seed();
		vi.mocked(syncNoteMentionsFromText).mockRejectedValueOnce(new Error("graph down"));
		const result = await call("update_note", { id: titled.id, append: "kept", dated: false });
		expect(result.isError).toBe(true);
		expect((await call("get_note", { id: titled.id })).json().body).toBe("tomatoes\nkept");
		expect(await ledger("mcp.note.updated")).toEqual([
			{ type: "mcp.note.updated", source_ref: titled.id },
		]);
	});

	it("update_note writes no ledger row for a refused append", async () => {
		await seed();
		const missing = await call("update_note", { id: crypto.randomUUID(), append: "x" });
		expect(missing).toMatchObject({ isError: true, text: "No note with that id." });
		expect(await ledger("mcp.note.updated")).toEqual([]);
	});
});
