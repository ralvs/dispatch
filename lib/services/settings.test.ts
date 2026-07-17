import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { todayInTz } from "@/lib/dates";
import { todayForRequest } from "@/lib/services/settings";

// Stub covering .from("app_settings").select().eq().maybeSingle().
function stubSupabase(timezone: string) {
	const sb = {
		from: vi.fn(() => ({
			select: vi.fn(() => ({
				eq: vi.fn(() => ({
					maybeSingle: vi.fn(async () => ({ data: { timezone }, error: null })),
				})),
			})),
		})),
	} as unknown as SupabaseClient;

	return sb;
}

describe("todayForRequest", () => {
	it("returns today's ISO date in the app timezone from app_settings", async () => {
		const tz = "America/Sao_Paulo";
		const sb = stubSupabase(tz);

		expect(await todayForRequest(sb)).toBe(todayInTz(tz));
	});
});
