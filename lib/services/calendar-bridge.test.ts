import { beforeEach, describe, expect, it } from "vitest";
import type { BridgeEvent } from "@/lib/schemas/calendar";
import { syncBridgeEvents } from "@/lib/services/calendar-bridge";
import { ServiceError } from "@/lib/services/errors";

type StubOpts = {
	existingRows?: { caldav_uid: string; caldav_etag: string; start_at: string }[];
};

function stubSupabase(opts: StubOpts = {}) {
	const upserts: { table: string; row: Record<string, unknown> }[] = [];
	const deletes: Record<string, unknown>[] = [];

	const sb = {
		from(table: string) {
			if (table === "calendar_events") {
				return {
					select(_cols: string) {
						return {
							eq(_col: string, _val: string) {
								return Promise.resolve({
									data: opts.existingRows ?? [],
									error: null,
								});
							},
						};
					},
					upsert(row: Record<string, unknown>) {
						upserts.push({ table, row });
						return Promise.resolve({ data: null, error: null });
					},
					delete() {
						const filters: Record<string, unknown> = {};
						const chain = {
							eq(col: string, val: unknown) {
								filters[`eq:${col}`] = val;
								return chain;
							},
							gte(col: string, val: unknown) {
								filters[`gte:${col}`] = val;
								return chain;
							},
							lt(col: string, val: unknown) {
								filters[`lt:${col}`] = val;
								return chain;
							},
							not(col: string, op: string, val: unknown) {
								filters[`not:${col}:${op}`] = val;
								return chain;
							},
							select(_cols: string) {
								deletes.push(filters);
								return Promise.resolve({ data: [{ id: "gone" }], error: null });
							},
						};
						return chain;
					},
				};
			}
			if (table === "google_sync_state") {
				return {
					upsert(row: Record<string, unknown>) {
						upserts.push({ table, row });
						return Promise.resolve({ data: null, error: null });
					},
				};
			}
			throw new Error(`unexpected table ${table}`);
		},
	};

	return { sb: sb as never, upserts, deletes };
}

function event(overrides: Partial<BridgeEvent> = {}): BridgeEvent {
	return {
		uid: "ek-1",
		title: "Eng sync",
		start_at: "2026-07-21T15:00:00.000Z",
		end_at: "2026-07-21T16:00:00.000Z",
		all_day: false,
		calendar_name: "Work",
		etag: "etag-1",
		...overrides,
	};
}

const WINDOW = {
	windowStart: "2026-07-14T00:00:00.000Z",
	windowEnd: "2026-07-28T00:00:00.000Z",
};

describe("syncBridgeEvents", () => {
	beforeEach(() => {});

	it("upserts new events as source=google", async () => {
		const { sb, upserts } = stubSupabase();
		const result = await syncBridgeEvents(sb, { events: [event()], ...WINDOW });
		expect(result.pulled).toBe(1);
		expect(upserts.find((u) => u.table === "calendar_events")?.row).toMatchObject({
			caldav_uid: "ek-1",
			source: "google",
			title: "Eng sync",
		});
	});

	it("skips unchanged etag+start", async () => {
		const { sb, upserts } = stubSupabase({
			existingRows: [
				{
					caldav_uid: "ek-1",
					caldav_etag: "etag-1",
					start_at: "2026-07-21T15:00:00.000Z",
				},
			],
		});
		const result = await syncBridgeEvents(sb, { events: [event()], ...WINDOW });
		expect(result.pulled).toBe(0);
		expect(upserts.find((u) => u.table === "calendar_events")).toBeUndefined();
	});

	it("set-difference deletes unseen google rows in window", async () => {
		const { sb, deletes } = stubSupabase();
		await syncBridgeEvents(sb, { events: [event()], ...WINDOW });
		expect(deletes[0]).toMatchObject({ "eq:source": "google" });
		expect(deletes[0]["not:caldav_uid:in"]).toContain("ek-1");
	});

	it("clears the window when events is empty", async () => {
		const { sb, deletes } = stubSupabase();
		await syncBridgeEvents(sb, { events: [], ...WINDOW });
		expect(deletes[0]).toMatchObject({ "eq:source": "google" });
		expect(deletes[0]["not:caldav_uid:in"]).toBeUndefined();
	});

	it("rejects inverted windows", async () => {
		const { sb } = stubSupabase();
		await expect(
			syncBridgeEvents(sb, {
				events: [],
				windowStart: "2026-07-28T00:00:00.000Z",
				windowEnd: "2026-07-14T00:00:00.000Z",
			}),
		).rejects.toBeInstanceOf(ServiceError);
	});
});
