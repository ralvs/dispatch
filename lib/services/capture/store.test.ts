import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { markParsed, persistRaw } from "@/lib/services/capture/store";

const RAW = { kind: "transcript", text: "verbatim", via: "text" } as const;

describe("persistRaw", () => {
	it("records the text verbatim under source=manual/type=text_capture", async () => {
		const inserts: Array<Record<string, unknown>> = [];
		const sb = {
			from: vi.fn(() => ({
				insert: vi.fn((row: Record<string, unknown>) => {
					inserts.push(row);
					return {
						select: vi.fn(() => ({
							single: vi.fn(async () => ({ data: { id: "cap-1" }, error: null })),
						})),
					};
				}),
			})),
		} as unknown as SupabaseClient;

		const id = await persistRaw(sb, RAW);

		expect(id).toBe("cap-1");
		expect(inserts[0]).toMatchObject({
			source: "manual",
			type: "text_capture",
			processed_status: "raw",
			payload: { transcript: "verbatim", via: "text", client_time: null },
		});
	});
});

describe("markParsed", () => {
	it("swallows a rejecting client so it can never escape into capture()", async () => {
		const sb = {
			from: vi.fn(() => ({
				update: vi.fn(() => ({
					eq: vi.fn(async () => {
						throw new Error("network down");
					}),
				})),
			})),
		} as unknown as SupabaseClient;

		await expect(markParsed(sb, "cap-1")).resolves.toBeUndefined();
	});
});
