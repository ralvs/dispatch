import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

// The AI gateway is faked: the parser reports a failure, never a paid call.
vi.mock("@/lib/ai/parser", () => ({ parse: vi.fn() }));
// Cache invalidation needs a Next request scope; there is none in a test.
vi.mock("@/lib/invalidate", async (original) => ({
	...(await original<typeof import("@/lib/invalidate")>()),
	afterExternalMutation: vi.fn(),
}));

import { POST } from "@/app/api/capture/route";
import { parse } from "@/lib/ai/parser";
import { serviceClient } from "@/test/integration/clients";

// The route test for bareUrl lives in route.test.ts; this one drives POST
// /api/capture end to end against the local database (iron rule #4).

const SECRET = "test-capture-secret-0123456789";
process.env.CAPTURE_WEBHOOK_SECRET = SECRET;

function post(body: unknown, secret = SECRET) {
	return POST(
		new Request("http://localhost/api/capture", {
			method: "POST",
			headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
			body: JSON.stringify(body),
		}),
	);
}

beforeEach(() => {
	vi.mocked(parse).mockReset();
	vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("POST /api/capture", () => {
	it("never loses a capture: a failed parse lands as a needs_review note", async () => {
		(parse as Mock).mockResolvedValue({ ok: false, reason: "failed", raw: "x" });

		const res = await post({ text: "ligar pro médico amanhã", via: "voice", source: "watch" });

		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json).toMatchObject({ kind: "capture", status: "parsed" });

		const sb = serviceClient();
		const { data: captured } = await sb
			.from("captured_data")
			.select("source, processed_status, payload")
			.eq("id", json.id)
			.single();
		expect(captured).toMatchObject({
			source: "watch",
			processed_status: "parsed",
			payload: { transcript: "ligar pro médico amanhã", via: "voice" },
		});

		const { data: notes } = await sb
			.from("notes")
			.select("body, needs_review, tags")
			.eq("origin_capture_id", json.id);
		expect(notes).toHaveLength(1);
		expect(notes?.[0]).toMatchObject({ body: "ligar pro médico amanhã", needs_review: true });
		expect(notes?.[0].tags).toContain("reason:parser_failed");

		const { data: ledger } = await sb
			.from("notifications")
			.select("type, source_ref")
			.eq("source_ref", json.id);
		expect(ledger).toEqual([{ type: "capture.text", source_ref: json.id }]);
	});

	it("rejects a wrong secret without writing anything", async () => {
		const res = await post({ text: "intruder" }, "wrong-secret-0123456789");

		expect(res.status).toBe(401);
		const { count } = await serviceClient()
			.from("captured_data")
			.select("id", { count: "exact", head: true });
		expect(count).toBe(0);
	});
});
