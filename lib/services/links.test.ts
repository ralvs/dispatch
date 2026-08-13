import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { CreateLinkSchema } from "@/lib/schemas/link";
import {
	createLink,
	listLinks,
	setLinkStatus,
	unreadLinkCount,
	updateLinkMetadata,
} from "@/lib/services/links";

type StubResult = { data?: unknown; error?: unknown; count?: number };

// Same chainable/thenable double the other service tests use: every builder
// method returns the builder, awaiting it resolves the configured result, and
// each terminal call is recorded so wiring can be asserted without a database.
function stubSupabase(results: Record<string, StubResult>) {
	const calls: Array<{ table: string; op: string; payload: unknown }> = [];

	const from = vi.fn((table: string) => {
		const res = results[table] ?? { data: null, error: null };
		// biome-ignore lint/suspicious/noExplicitAny: hand-rolled test double
		const builder: any = {};
		const record = (op: string) => (payload: unknown) => {
			calls.push({ table, op, payload });
			return builder;
		};
		builder.insert = record("insert");
		builder.update = record("update");
		builder.select = () => builder;
		builder.eq = (col: string, value: unknown) => {
			calls.push({ table, op: "eq", payload: { col, value } });
			return builder;
		};
		builder.order = record("order");
		builder.limit = record("limit");
		builder.single = async () => res;
		// biome-ignore lint/suspicious/noThenProperty: intentional thenable test double
		builder.then = (resolve: (v: StubResult) => unknown, reject: (e: unknown) => unknown) =>
			Promise.resolve(res).then(resolve, reject);
		return builder;
	});

	return { sb: { from } as unknown as SupabaseClient, calls };
}

describe("CreateLinkSchema", () => {
	it("accepts a bare url with no metadata", () => {
		expect(CreateLinkSchema.parse({ url: "https://example.com/post" }).url).toBe(
			"https://example.com/post",
		);
	});

	it("rejects a javascript: payload even though it parses as a URL", () => {
		expect(CreateLinkSchema.safeParse({ url: "javascript:alert(1)" }).success).toBe(false);
	});

	it("rejects anything that is not a URL at all", () => {
		expect(CreateLinkSchema.safeParse({ url: "not a link" }).success).toBe(false);
	});
});

describe("listLinks", () => {
	it("returns the rows newest first", async () => {
		const rows = [{ id: "a" }, { id: "b" }];
		const { sb } = stubSupabase({ ingest_links: { data: rows, error: null } });
		expect(await listLinks(sb)).toEqual(rows);
	});

	it("applies the status filter and limit when asked", async () => {
		const { sb, calls } = stubSupabase({ ingest_links: { data: [], error: null } });
		await listLinks(sb, { status: "unread", limit: 20 });
		expect(calls).toEqual([
			{ table: "ingest_links", op: "order", payload: "created_at" },
			{ table: "ingest_links", op: "eq", payload: { col: "status", value: "unread" } },
			{ table: "ingest_links", op: "limit", payload: 20 },
		]);
	});

	it("omits both when not asked", async () => {
		const { sb, calls } = stubSupabase({ ingest_links: { data: [], error: null } });
		await listLinks(sb);
		expect(calls).toEqual([{ table: "ingest_links", op: "order", payload: "created_at" }]);
	});
});

describe("createLink", () => {
	it("coerces omitted metadata to null and lets the DB default the status", async () => {
		const { sb, calls } = stubSupabase({
			ingest_links: { data: { id: "l1" }, error: null },
		});

		const row = await createLink(sb, { url: "https://example.com" });

		expect(row).toMatchObject({ id: "l1" });
		expect(calls[0]).toEqual({
			table: "ingest_links",
			op: "insert",
			payload: { url: "https://example.com", title: null, description: null, source: null },
		});
	});

	it("stores the title, description, and source it was given", async () => {
		const { sb, calls } = stubSupabase({ ingest_links: { data: { id: "l2" }, error: null } });

		await createLink(sb, {
			url: "https://example.com/a",
			title: "A post",
			description: "Worth reading",
			source: "share_sheet",
		});

		expect(calls[0].payload).toEqual({
			url: "https://example.com/a",
			title: "A post",
			description: "Worth reading",
			source: "share_sheet",
		});
	});
});

describe("updateLinkMetadata", () => {
	it("patches title and description by id", async () => {
		const { sb, calls } = stubSupabase({
			ingest_links: { data: { id: "l1", title: "A post" }, error: null },
		});

		const row = await updateLinkMetadata(sb, "l1", {
			title: "A post",
			description: "Worth reading",
		});

		expect(row).toMatchObject({ id: "l1", title: "A post" });
		expect(calls).toEqual([
			{
				table: "ingest_links",
				op: "update",
				payload: { title: "A post", description: "Worth reading" },
			},
			{ table: "ingest_links", op: "eq", payload: { col: "id", value: "l1" } },
		]);
	});
});

describe("setLinkStatus", () => {
	it("updates the status by id", async () => {
		const { sb, calls } = stubSupabase({ ingest_links: { data: null, error: null } });
		await setLinkStatus(sb, "l1", "read");
		expect(calls).toEqual([
			{ table: "ingest_links", op: "update", payload: { status: "read" } },
			{ table: "ingest_links", op: "eq", payload: { col: "id", value: "l1" } },
		]);
	});

	it("can put a link back to unread", async () => {
		const { sb, calls } = stubSupabase({ ingest_links: { data: null, error: null } });
		await setLinkStatus(sb, "l1", "unread");
		expect(calls[0].payload).toEqual({ status: "unread" });
	});
});

describe("unreadLinkCount", () => {
	it("counts only unread links", async () => {
		const { sb, calls } = stubSupabase({ ingest_links: { count: 4, error: null } });
		expect(await unreadLinkCount(sb)).toBe(4);
		expect(calls).toEqual([
			{ table: "ingest_links", op: "eq", payload: { col: "status", value: "unread" } },
		]);
	});
});
