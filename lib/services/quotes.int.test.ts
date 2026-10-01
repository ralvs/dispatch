import { describe, expect, it } from "vitest";
import {
	createAnnotation,
	createQuote,
	deleteQuote,
	getQuote,
	listAnnotations,
} from "@/lib/services/quotes";
import { ownerClient } from "@/test/integration/clients";

describe("quotes against the local database", () => {
	it("defaults added_via to manual and stores text verbatim", async () => {
		const sb = await ownerClient();
		const quote = await createQuote(sb, { text: "a quotation" });

		expect(await getQuote(sb, quote.id)).toMatchObject({
			text: "a quotation",
			added_via: "manual",
		});
	});

	it("preserves an explicit added_via (e.g. voice capture)", async () => {
		const sb = await ownerClient();
		const quote = await createQuote(sb, { text: "spoken quote", added_via: "voice" });

		expect((await getQuote(sb, quote.id))?.added_via).toBe("voice");
	});

	it("stores an annotation verbatim, and deleting the quote cascades to it", async () => {
		const sb = await ownerClient();
		const quote = await createQuote(sb, { text: "stay hungry" });
		await createAnnotation(sb, { quote_id: quote.id, body: "this hit different" });
		expect(await listAnnotations(sb, quote.id)).toMatchObject([
			{ quote_id: quote.id, body: "this hit different" },
		]);

		await deleteQuote(sb, quote.id);

		expect(await getQuote(sb, quote.id)).toBeNull();
		const { data } = await sb.from("quote_annotations").select("id").eq("quote_id", quote.id);
		expect(data).toEqual([]);
	});
});
