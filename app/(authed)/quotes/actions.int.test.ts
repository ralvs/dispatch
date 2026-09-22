import { describe, expect, it, vi } from "vitest";
import { ownerClient } from "@/test/integration/clients";
import { createQuoteAction } from "./actions";

// The guard reads cookies and the invalidation needs a Next request scope;
// neither exists here. Everything between them runs for real.
vi.mock("@/lib/auth", () => ({
	requireOwnerPage: async () => ({ sb: await ownerClient() }),
}));
vi.mock("@/lib/mutation-feedback/invalidate", () => ({ afterMutation: vi.fn() }));

function form(entries: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(entries)) fd.set(k, v);
	return fd;
}

async function quoteCount(): Promise<number> {
	const { count } = await (await ownerClient())
		.from("quotes")
		.select("*", { count: "exact", head: true });
	return count ?? 0;
}

describe("createQuoteAction against the local database", () => {
	it("returns field errors for an invalid quote and writes nothing", async () => {
		const result = await createQuoteAction(form({ text: "", source_author: "Seneca" }));

		expect(result).toMatchObject({
			ok: false,
			fieldErrors: { text: ["Write the quote."] },
			values: { text: "", source_author: "Seneca" },
		});
		expect(await quoteCount()).toBe(0);
	});

	it("writes a valid quote", async () => {
		const result = await createQuoteAction(
			form({ text: "We suffer more in imagination", source_author: "Seneca", tags: "stoic" }),
		);

		expect(result).toEqual({ ok: true, data: undefined });
		expect(await quoteCount()).toBe(1);
	});
});
