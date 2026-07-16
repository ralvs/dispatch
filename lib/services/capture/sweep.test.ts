import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { sweepRawCaptures } from "@/lib/services/capture/sweep";

// Hand-rolled stub mirroring the exact chains the sweep uses:
//   captured_data: select().eq().lt()  → orphans
//   notes:         select().in()      → already-linked rows
//   notes:         insert().select().single() → degrade note
//   captured_data: update().eq()      → markParsed
function stubSb(opts: { orphans: Array<{ id: string; payload: unknown }>; linked: string[] }) {
	const noteInserts: Array<Record<string, unknown>> = [];
	const parsedIds: string[] = [];
	let capturedLt: string | undefined;

	const sb = {
		from: vi.fn((table: string) => {
			if (table === "captured_data") {
				return {
					select: vi.fn(() => ({
						eq: vi.fn(() => ({
							lt: vi.fn(async (_col: string, cutoff: string) => {
								capturedLt = cutoff;
								return { data: opts.orphans, error: null };
							}),
						})),
					})),
					update: vi.fn(() => ({
						eq: vi.fn(async (_col: string, id: string) => {
							parsedIds.push(id);
							return { data: null, error: null };
						}),
					})),
				};
			}
			// notes
			return {
				select: vi.fn(() => ({
					in: vi.fn(async () => ({
						data: opts.linked.map((id) => ({ origin_capture_id: id })),
						error: null,
					})),
				})),
				insert: vi.fn((row: Record<string, unknown>) => {
					noteInserts.push(row);
					return {
						select: vi.fn(() => ({
							single: vi.fn(async () => ({
								data: { id: `note-${noteInserts.length}`, ...row },
								error: null,
							})),
						})),
					};
				}),
			};
		}),
	} as unknown as SupabaseClient;

	return { sb, noteInserts, parsedIds, getCapturedLt: () => capturedLt };
}

describe("sweepRawCaptures", () => {
	it("degrades an orphan to a needs_review note and marks it parsed", async () => {
		const { sb, noteInserts, parsedIds } = stubSb({
			orphans: [{ id: "cap-1", payload: { transcript: "comprar leite", via: "voice" } }],
			linked: [],
		});

		const result = await sweepRawCaptures(sb);

		expect(result).toEqual({ swept: ["cap-1"], reconciled: [] });
		expect(noteInserts[0]).toMatchObject({
			body: "comprar leite",
			needs_review: true,
			origin_capture_id: "cap-1",
		});
		expect(parsedIds).toEqual(["cap-1"]);
	});

	it("skips the note (dedupe) but still marks parsed when a note already links", async () => {
		const { sb, noteInserts, parsedIds } = stubSb({
			orphans: [{ id: "cap-1", payload: { transcript: "x" } }],
			linked: ["cap-1"],
		});

		const result = await sweepRawCaptures(sb);

		expect(result).toEqual({ swept: [], reconciled: ["cap-1"] });
		expect(noteInserts).toHaveLength(0);
		expect(parsedIds).toEqual(["cap-1"]);
	});

	it("falls back to JSON for a payload without a transcript", async () => {
		const { sb, noteInserts } = stubSb({
			orphans: [{ id: "cap-2", payload: { foo: 1 } }],
			linked: [],
		});

		await sweepRawCaptures(sb);

		expect(noteInserts[0]).toMatchObject({ body: '{"foo":1}' });
	});

	it("applies the threshold to the cutoff and returns empty when nothing is stuck", async () => {
		const { sb, getCapturedLt } = stubSb({ orphans: [], linked: [] });
		const nowMs = Date.UTC(2026, 6, 16, 12, 0, 0);

		const result = await sweepRawCaptures(sb, { nowMs, olderThanMinutes: 10 });

		expect(result).toEqual({ swept: [], reconciled: [] });
		expect(getCapturedLt()).toBe("2026-07-16T11:50:00.000Z");
	});
});
