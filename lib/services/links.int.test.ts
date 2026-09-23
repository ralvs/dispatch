import { describe, expect, it } from "vitest";
import { createLink, listLinks, updateLinkMetadata } from "@/lib/services/links";
import { serviceClient } from "@/test/integration/clients";

// The capture route's two writes, against the real table: a bare row first,
// then the metadata patch (iron rule #4, docs/adr/0064).

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
});
