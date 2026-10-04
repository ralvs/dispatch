import { describe, expect, it, vi } from "vitest";

// Cache invalidation needs a Next request scope; there is none in a test.
vi.mock("@/lib/invalidate", async (original) => ({
	...(await original<typeof import("@/lib/invalidate")>()),
	afterExternalMutation: vi.fn(),
}));

import { GET } from "@/app/api/cron/sweep/route";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/invalidate";
import { listNotifications } from "@/lib/services/notifications";
import { serviceClient } from "@/test/integration/clients";

// GET /api/cron/sweep end to end against the local database: the bare ledger
// call can no longer fail the cron (ADR-0075), and the row busts its own tags.

const SECRET = "test-cron-secret-0123456789"; // gitleaks:allow
process.env.CRON_SECRET = SECRET;

describe("GET /api/cron/sweep", () => {
	it("degrades a stale capture, records one ledger row and busts both kinds", async () => {
		const sb = serviceClient();
		const { error } = await sb.from("captured_data").insert({
			source: "manual",
			type: "text_capture",
			payload: { transcript: "comprar leite" },
			created_at: new Date(Date.now() - 60 * 60_000).toISOString(),
		});
		if (error) throw error;

		const res = await GET(
			new Request("http://localhost/api/cron/sweep", {
				headers: { authorization: `Bearer ${SECRET}` },
			}),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ swept: 1, reconciled: 0 });
		const rows = await listNotifications(sb);
		expect(rows.map((r) => r.type)).toEqual(["cron.sweep"]);
		expect(afterExternalMutation).toHaveBeenCalledWith(...EXTERNAL_WRITES.sweep);
		expect(afterExternalMutation).toHaveBeenCalledWith("notification.write");
	});
});
