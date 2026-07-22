import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleCalendarConnection } from "@/lib/google/client";
import { ServiceError } from "@/lib/services/errors";
import { syncGoogleCalendar } from "@/lib/services/google-calendar";

const NOW_MS = Date.parse("2026-07-21T12:00:00.000Z");

const ICS_ONE_EVENT = [
	"BEGIN:VCALENDAR",
	"VERSION:2.0",
	"BEGIN:VEVENT",
	"UID:work-evt-1@google.com",
	"DTSTART:20260721T150000Z",
	"DTEND:20260721T160000Z",
	"SUMMARY:Eng sync",
	"END:VEVENT",
	"END:VCALENDAR",
].join("\r\n");

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

function fakeConn(overrides: Partial<GoogleCalendarConnection> = {}): GoogleCalendarConnection {
	return {
		listFeeds: () => [
			{ name: "Work", url: "https://calendar.google.com/calendar/ical/x/private-y/basic.ics" },
		],
		fetchFeed: vi.fn(async () => ({ etag: "etag-1", data: ICS_ONE_EVENT })),
		...overrides,
	};
}

describe("syncGoogleCalendar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("upserts parsed ICS events on source+caldav_uid", async () => {
		const { sb, upserts } = stubSupabase();
		const conn = fakeConn();

		const result = await syncGoogleCalendar(sb, conn, { nowMs: NOW_MS });

		expect(result.pulled).toBe(1);
		const eventUpsert = upserts.find((u) => u.table === "calendar_events");
		expect(eventUpsert?.row).toMatchObject({
			caldav_uid: "work-evt-1@google.com",
			calendar_name: "Work",
			title: "Eng sync",
			source: "google",
			caldav_etag: "etag-1",
		});
		expect(eventUpsert?.opts).toMatchObject({ onConflict: "source,caldav_uid" });
	});

	it("skips upsert when feed etag and start are unchanged", async () => {
		const { sb, upserts } = stubSupabase({
			existingRows: [
				{
					caldav_uid: "work-evt-1@google.com",
					caldav_etag: "etag-1",
					start_at: "2026-07-21T15:00:00.000Z",
				},
			],
		});
		const conn = fakeConn();

		const result = await syncGoogleCalendar(sb, conn, { nowMs: NOW_MS });

		expect(result.pulled).toBe(0);
		expect(upserts.find((u) => u.table === "calendar_events")).toBeUndefined();
	});

	it("updates google_sync_state with counts", async () => {
		const { sb, upserts } = stubSupabase();
		await syncGoogleCalendar(sb, fakeConn(), { nowMs: NOW_MS });
		expect(upserts.find((u) => u.table === "google_sync_state")?.row).toMatchObject({
			last_result: { pulled: 1, removed: 1 },
		});
	});

	it("deletes only in-window google rows not seen this sync", async () => {
		const { sb, deleteFilters } = stubSupabase();
		await syncGoogleCalendar(sb, fakeConn(), { nowMs: NOW_MS });
		expect(deleteFilters[0]).toMatchObject({ "eq:source": "google" });
		expect(deleteFilters[0]["not:caldav_uid:in"]).toContain("work-evt-1@google.com");
	});

	it("throws without deleting when every feed fails", async () => {
		const { sb, upserts } = stubSupabase();
		const conn = fakeConn({
			fetchFeed: vi.fn(async () => {
				throw new Error("network");
			}),
		});
		await expect(syncGoogleCalendar(sb, conn, { nowMs: NOW_MS })).rejects.toBeInstanceOf(
			ServiceError,
		);
		expect(upserts.find((u) => u.table === "google_sync_state")).toBeUndefined();
	});

	it("throws when no feeds are configured", async () => {
		const { sb } = stubSupabase();
		const conn = fakeConn({ listFeeds: () => [] });
		await expect(syncGoogleCalendar(sb, conn, { nowMs: NOW_MS })).rejects.toBeInstanceOf(
			ServiceError,
		);
	});

	it("skips set-difference when no events were seen", async () => {
		const { sb, deleteFilters } = stubSupabase();
		const emptyIcs = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR";
		const conn = fakeConn({
			fetchFeed: vi.fn(async () => ({ etag: "e", data: emptyIcs })),
		});
		const result = await syncGoogleCalendar(sb, conn, { nowMs: NOW_MS });
		expect(result.removed).toBe(0);
		expect(deleteFilters).toHaveLength(0);
	});
});
