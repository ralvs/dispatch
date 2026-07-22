import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleCalendarConnection } from "@/lib/google/client";
import type { GoogleRemoteEvent } from "@/lib/google/map-event";
import { ServiceError } from "@/lib/services/errors";
import { syncGoogleCalendar } from "@/lib/services/google-calendar";

const NOW_MS = Date.parse("2026-07-21T12:00:00.000Z");

type StubOpts = {
	existingRows?: { caldav_uid: string; caldav_etag: string; start_at: string }[];
};

function stubSupabase(opts: StubOpts = {}) {
	const upserts: { table: string; row: Record<string, unknown>; opts?: unknown }[] = [];
	const deleteFilters: Record<string, unknown>[] = [];

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
					upsert(row: Record<string, unknown>, upsertOpts?: unknown) {
						upserts.push({ table, row, opts: upsertOpts });
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
								deleteFilters.push(filters);
								return Promise.resolve({ data: [{ id: "gone" }], error: null });
							},
						};
						return chain;
					},
				};
			}
			if (table === "google_sync_state") {
				return {
					select(_cols: string) {
						return {
							eq(_col: string, _val: unknown) {
								return {
									maybeSingle() {
										return Promise.resolve({
											data: {
												refresh_token: "rt",
												account_email: "a@b.com",
												connected_at: "2026-01-01T00:00:00.000Z",
											},
											error: null,
										});
									},
								};
							},
						};
					},
					upsert(row: Record<string, unknown>, upsertOpts?: unknown) {
						upserts.push({ table, row, opts: upsertOpts });
						return Promise.resolve({ data: null, error: null });
					},
				};
			}
			throw new Error(`unexpected table ${table}`);
		},
	};

	return { sb: sb as never, upserts, deleteFilters };
}

function timedEvent(overrides: Partial<GoogleRemoteEvent> = {}): GoogleRemoteEvent {
	return {
		id: "gcal-1",
		etag: "etag-1",
		status: "confirmed",
		summary: "Eng sync",
		start: { dateTime: "2026-07-21T15:00:00.000Z" },
		end: { dateTime: "2026-07-21T16:00:00.000Z" },
		...overrides,
	};
}

function fakeConn(overrides: Partial<GoogleCalendarConnection> = {}): GoogleCalendarConnection {
	return {
		listCalendars: vi.fn(async () => [{ id: "primary", summary: "Work" }]),
		listEventsInWindow: vi.fn(async () => [timedEvent()]),
		...overrides,
	};
}

describe("syncGoogleCalendar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("upserts mapped events on source+caldav_uid", async () => {
		const { sb, upserts } = stubSupabase();
		const result = await syncGoogleCalendar(sb, fakeConn(), { nowMs: NOW_MS });
		expect(result.pulled).toBe(1);
		expect(upserts.find((u) => u.table === "calendar_events")?.row).toMatchObject({
			caldav_uid: "gcal-1",
			source: "google",
			title: "Eng sync",
		});
	});

	it("skips upsert when etag and start unchanged", async () => {
		const { sb, upserts } = stubSupabase({
			existingRows: [
				{
					caldav_uid: "gcal-1",
					caldav_etag: "etag-1",
					start_at: "2026-07-21T15:00:00.000Z",
				},
			],
		});
		const result = await syncGoogleCalendar(sb, fakeConn(), { nowMs: NOW_MS });
		expect(result.pulled).toBe(0);
		expect(upserts.find((u) => u.table === "calendar_events")).toBeUndefined();
	});

	it("preserves refresh_token when writing sync state", async () => {
		const { sb, upserts } = stubSupabase();
		await syncGoogleCalendar(sb, fakeConn(), { nowMs: NOW_MS });
		expect(upserts.find((u) => u.table === "google_sync_state")?.row).toMatchObject({
			refresh_token: "rt",
			account_email: "a@b.com",
			last_result: { pulled: 1, removed: 1 },
		});
	});

	it("throws when every calendar fetch fails", async () => {
		const { sb } = stubSupabase();
		const conn = fakeConn({
			listEventsInWindow: vi.fn(async () => {
				throw new Error("network");
			}),
		});
		await expect(syncGoogleCalendar(sb, conn, { nowMs: NOW_MS })).rejects.toBeInstanceOf(
			ServiceError,
		);
	});
});
