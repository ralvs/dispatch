import { describe, expect, it } from "vitest";
import { createLink, listLinks, setLinkStatus, updateLinkMetadata } from "@/lib/services/links";
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
});
