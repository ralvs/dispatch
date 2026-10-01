import { describe, expect, it } from "vitest";
import {
	createLink,
	listLinks,
	setLinkStatus,
	unreadLinkCount,
	updateLinkMetadata,
} from "@/lib/services/links";
import { ownerClient, serviceClient } from "@/test/integration/clients";

// The capture route's two writes, against the real table: a bare row first,
// then the metadata patch (iron rule #4, docs/adr/0066).

describe("links against the local database", () => {
	it("saves a bare link, then patches title, description and image", async () => {
		const sb = serviceClient();
		const saved = await createLink(sb, {
			url: "https://x.com/TablePlus/status/2102636659049464298",
			source: "webhook",
		});
		expect(saved).toMatchObject({ title: null, description: null, image_url: null });

		await updateLinkMetadata(sb, saved.id, {
			title: "TablePlus (@TablePlus)",
			description: "https://TinyWeb.so now only 4 MB",
			image: "https://pbs.twimg.com/media/HS4QmjdaMAABWRs.jpg?name=orig",
		});

		const [row] = await listLinks(sb);
		expect(row).toMatchObject({
			id: saved.id,
			title: "TablePlus (@TablePlus)",
			image_url: "https://pbs.twimg.com/media/HS4QmjdaMAABWRs.jpg?name=orig",
		});
	});

	it("sets a status and returns the row, which the entity store confirms from (#30)", async () => {
		const saved = await createLink(serviceClient(), {
			url: "https://example.com/a",
			source: "webhook",
		});
		const sb = await ownerClient();

		expect(await setLinkStatus(sb, saved.id, "read")).toMatchObject({
			id: saved.id,
			status: "read",
		});
		// Every status is reachable from every other.
		expect(await setLinkStatus(sb, saved.id, "unread")).toMatchObject({ status: "unread" });
		expect(await setLinkStatus(sb, crypto.randomUUID(), "read")).toBeNull();
	});

	it("stores a bare url with null metadata and lets the database default the status", async () => {
		const sb = await ownerClient();
		const saved = await createLink(sb, { url: "https://example.com" });

		expect(saved).toMatchObject({
			url: "https://example.com",
			title: null,
			description: null,
			source: null,
			status: "unread",
		});
	});

	it("stores the title, description and source it was given", async () => {
		const sb = await ownerClient();
		const saved = await createLink(sb, {
			url: "https://example.com/a",
			title: "A post",
			description: "Worth reading",
			source: "share_sheet",
		});

		expect(saved).toMatchObject({
			title: "A post",
			description: "Worth reading",
			source: "share_sheet",
		});
	});

	it("lists newest first, and narrows by status and limit when asked", async () => {
		const sb = await ownerClient();
		const oldest = await createLink(sb, { url: "https://example.com/1" });
		const middle = await createLink(sb, { url: "https://example.com/2" });
		const newest = await createLink(sb, { url: "https://example.com/3" });
		// Pin created_at so the order does not hang on insert timing.
		const service = serviceClient();
		for (const [id, at] of [
			[oldest.id, "2026-01-01T00:00:00Z"],
			[middle.id, "2026-01-02T00:00:00Z"],
			[newest.id, "2026-01-03T00:00:00Z"],
		]) {
			const { data, error } = await service
				.from("ingest_links")
				.update({ created_at: at })
				.eq("id", id)
				.select("created_at")
				.single();
			expect(error).toBeNull();
			expect(new Date(data?.created_at).toISOString()).toBe(new Date(at).toISOString());
		}
		await setLinkStatus(sb, middle.id, "read");

		expect((await listLinks(sb)).map((l) => l.id)).toEqual([newest.id, middle.id, oldest.id]);
		expect((await listLinks(sb, { status: "unread" })).map((l) => l.id)).toEqual([
			newest.id,
			oldest.id,
		]);
		expect((await listLinks(sb, { status: "unread", limit: 1 })).map((l) => l.id)).toEqual([
			newest.id,
		]);
	});

	it("counts only unread links", async () => {
		const sb = await ownerClient();
		const read = await createLink(sb, { url: "https://example.com/read" });
		const dismissed = await createLink(sb, { url: "https://example.com/dismissed" });
		await createLink(sb, { url: "https://example.com/unread-1" });
		await createLink(sb, { url: "https://example.com/unread-2" });
		await setLinkStatus(sb, read.id, "read");
		await setLinkStatus(sb, dismissed.id, "dismissed");

		expect(await unreadLinkCount(sb)).toBe(2);
	});
});
