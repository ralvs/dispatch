import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { CaldavConnection } from "@/lib/caldav/client";

vi.mock("@/lib/env", () => ({
	env: () => ({ ICLOUD_CALENDAR_NAME: "Dispatch" }),
	isCaldavConfigured: vi.fn(() => true),
}));

import { createEventHere, listEventsOn, syncCalendar } from "@/lib/services/calendar";
import { ServiceError } from "@/lib/services/errors";

const NOW_MS = Date.parse("2026-07-16T12:00:00.000Z");

// ─── calendar_events / caldav_sync_state stub ──────────────────────────────

function stubSupabase(
	opts: { deleteResult?: unknown[]; selectResult?: unknown[]; existingRows?: unknown[] } = {},
) {
	const upserts: Array<{ table: string; row: unknown; opts: unknown }> = [];
	const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
	const deleteFilters: Record<string, unknown>[] = [];
	const selectArgs: { lt?: unknown; gt?: unknown } = {};

	const sb = {
		from: vi.fn((table: string) => {
			if (table === "calendar_events") {
				return {
					upsert: vi.fn((row: unknown, upsertOpts: unknown) => {
						upserts.push({ table, row, opts: upsertOpts });
						return Promise.resolve({ data: null, error: null });
					}),
					insert: vi.fn((row: Record<string, unknown>) => {
						inserts.push({ table, row });
						return {
							select: vi.fn(() => ({
								single: vi.fn(async () => ({
									data: { id: "new-event-id", ...row },
									error: null,
								})),
							})),
						};
					}),
					delete: vi.fn(() => {
						const filters: Record<string, unknown> = {};
						const builder = {
							eq: vi.fn((col: string, val: unknown) => {
								filters[`eq:${col}`] = val;
								return builder;
							}),
							gte: vi.fn((col: string, val: unknown) => {
								filters[`gte:${col}`] = val;
								return builder;
							}),
							lt: vi.fn((col: string, val: unknown) => {
								filters[`lt:${col}`] = val;
								return builder;
							}),
							not: vi.fn((col: string, op: string, val: unknown) => {
								filters[`not:${col}:${op}`] = val;
								return builder;
							}),
							select: vi.fn(async () => {
								deleteFilters.push(filters);
								return { data: opts.deleteResult ?? [], error: null };
							}),
						};
						return builder;
					}),
					select: vi.fn(() => {
						const builder = {
							// syncCalendar's known-rows preload: select(...).eq("source","caldav")
							eq: vi.fn(async () => ({ data: opts.existingRows ?? [], error: null })),
							lt: vi.fn((_col: string, val: unknown) => {
								selectArgs.lt = val;
								return builder;
							}),
							gt: vi.fn((_col: string, val: unknown) => {
								selectArgs.gt = val;
								return builder;
							}),
							order: vi.fn(async () => ({ data: opts.selectResult ?? [], error: null })),
						};
						return builder;
					}),
				};
			}
			if (table === "caldav_sync_state") {
				return {
					upsert: vi.fn((row: unknown, upsertOpts: unknown) => {
						upserts.push({ table, row, opts: upsertOpts });
						return Promise.resolve({ data: null, error: null });
					}),
				};
			}
			throw new Error(`stubSupabase: unexpected table "${table}"`);
		}),
	} as unknown as SupabaseClient;

	return { sb, upserts, inserts, deleteFilters, selectArgs };
}

function fakeConn(overrides: Partial<CaldavConnection> = {}): CaldavConnection {
	return {
		listCalendars: vi.fn(async () => [{ displayName: "Home", url: "https://cal/home" }]),
		fetchObjectsInWindow: vi.fn(async () => []),
		createObject: vi.fn(async () => undefined),
		...overrides,
	};
}

const ICS_ONE_EVENT = [
	"BEGIN:VCALENDAR",
	"VERSION:2.0",
	"BEGIN:VEVENT",
	"UID:evt-1@icloud.com",
	"DTSTAMP:20260701T000000Z",
	"DTSTART:20260716T140000Z",
	"DTEND:20260716T150000Z",
	"SUMMARY:Dentist",
	"END:VEVENT",
	"END:VCALENDAR",
].join("\n");

describe("syncCalendar", () => {
	it("upserts parsed events on caldav_uid", async () => {
		const { sb, upserts } = stubSupabase();
		const conn = fakeConn({
			fetchObjectsInWindow: vi.fn(async () => [
				{ href: "https://cal/home/evt-1.ics", etag: "etag-1", data: ICS_ONE_EVENT },
			]),
		});

		const result = await syncCalendar(sb, conn, { nowMs: NOW_MS });

		expect(result.pulled).toBe(1);
		const eventUpsert = upserts.find((u) => u.table === "calendar_events");
		expect(eventUpsert?.row).toMatchObject({
			caldav_uid: "evt-1@icloud.com",
			calendar_name: "Home",
			title: "Dentist",
			source: "caldav",
		});
		expect(eventUpsert?.opts).toMatchObject({ onConflict: "source,caldav_uid" });
	});

	it("skips the upsert (and the count) for an event with unchanged etag and start", async () => {
		const { sb, upserts } = stubSupabase({
			existingRows: [
				{
					caldav_uid: "evt-1@icloud.com",
					caldav_etag: "etag-1",
					start_at: "2026-07-16T14:00:00+00:00",
				},
			],
		});
		const conn = fakeConn({
			fetchObjectsInWindow: vi.fn(async () => [
				{ href: "https://cal/home/evt-1.ics", etag: "etag-1", data: ICS_ONE_EVENT },
			]),
		});

		const result = await syncCalendar(sb, conn, { nowMs: NOW_MS });

		expect(result.pulled).toBe(0);
		expect(upserts.find((u) => u.table === "calendar_events")).toBeUndefined();
	});

	it("re-upserts when the etag matches but the resolved start moved (recurring event)", async () => {
		const { sb, upserts } = stubSupabase({
			existingRows: [
				{
					caldav_uid: "evt-1@icloud.com",
					caldav_etag: "etag-1",
					start_at: "2026-07-09T14:00:00+00:00",
				},
			],
		});
		const conn = fakeConn({
			fetchObjectsInWindow: vi.fn(async () => [
				{ href: "https://cal/home/evt-1.ics", etag: "etag-1", data: ICS_ONE_EVENT },
			]),
		});

		const result = await syncCalendar(sb, conn, { nowMs: NOW_MS });

		expect(result.pulled).toBe(1);
		expect(upserts.find((u) => u.table === "calendar_events")).toBeDefined();
	});

	it("updates the caldav_sync_state singleton with the run's counts", async () => {
		const { sb, upserts } = stubSupabase();
		const conn = fakeConn({
			fetchObjectsInWindow: vi.fn(async () => [
				{ href: "https://cal/home/evt-1.ics", etag: "etag-1", data: ICS_ONE_EVENT },
			]),
		});

		await syncCalendar(sb, conn, { nowMs: NOW_MS });

		const stateUpsert = upserts.find((u) => u.table === "caldav_sync_state");
		expect(stateUpsert?.row).toMatchObject({
			id: true,
			last_result: { pulled: 1, removed: 0 },
		});
		expect(stateUpsert?.opts).toMatchObject({ onConflict: "id" });
	});

	it("deletes only in-window caldav rows not seen this sync (set-difference)", async () => {
		const { sb, deleteFilters } = stubSupabase({
			deleteResult: [{ id: "gone-1" }, { id: "gone-2" }],
		});
		const conn = fakeConn({
			fetchObjectsInWindow: vi.fn(async () => [
				{ href: "https://cal/home/evt-1.ics", etag: "etag-1", data: ICS_ONE_EVENT },
			]),
		});

		const result = await syncCalendar(sb, conn, { nowMs: NOW_MS });

		expect(result.removed).toBe(2);
		expect(deleteFilters).toHaveLength(1);
		expect(deleteFilters[0]).toMatchObject({ "eq:source": "caldav" });
		expect(deleteFilters[0]["not:caldav_uid:in"]).toContain("evt-1@icloud.com");
	});

	it("throws without deleting when every calendar fetch fails", async () => {
		const { sb, deleteFilters, upserts } = stubSupabase();
		const conn = fakeConn({
			listCalendars: vi.fn(async () => [{ displayName: "Home", url: "https://cal/home" }]),
			fetchObjectsInWindow: vi.fn(async () => {
				throw new Error("network down");
			}),
		});

		await expect(syncCalendar(sb, conn, { nowMs: NOW_MS })).rejects.toBeInstanceOf(ServiceError);
		expect(deleteFilters).toHaveLength(0);
		expect(upserts.find((u) => u.table === "caldav_sync_state")).toBeUndefined();
	});

	it("skips the delete when no events were seen, even if fetches succeeded", async () => {
		const { sb, deleteFilters } = stubSupabase();
		const conn = fakeConn({ fetchObjectsInWindow: vi.fn(async () => []) });

		const result = await syncCalendar(sb, conn, { nowMs: NOW_MS });

		expect(result).toEqual({ pulled: 0, removed: 0 });
		expect(deleteFilters).toHaveLength(0);
	});
});

describe("listEventsOn", () => {
	it("queries the day window in the given timezone", async () => {
		const rows = [{ id: "evt-1", title: "Dentist" }];
		const { sb, selectArgs } = stubSupabase({ selectResult: rows });

		const result = await listEventsOn(sb, "2026-07-16", "America/Sao_Paulo");

		expect(result).toEqual(rows);
		// 2026-07-16 America/Sao_Paulo (UTC-3) day window, in UTC.
		expect(selectArgs.lt).toBe("2026-07-17T03:00:00.000Z");
		expect(selectArgs.gt).toBe("2026-07-16T03:00:00.000Z");
	});
});

describe("createEventHere", () => {
	it("targets the calendar named by ICLOUD_CALENDAR_NAME and inserts source='created_here'", async () => {
		const { sb, inserts } = stubSupabase();
		const createObject = vi.fn(async () => undefined);
		const conn = fakeConn({
			listCalendars: vi.fn(async () => [
				{ displayName: "Home", url: "https://cal/home" },
				{ displayName: "Dispatch", url: "https://cal/dispatch" },
			]),
			createObject,
		});

		const result = await createEventHere(sb, conn, {
			title: "Write report",
			startUtc: "2026-07-20T13:00:00.000Z",
			endUtc: "2026-07-20T14:00:00.000Z",
		});

		expect(createObject).toHaveBeenCalledWith(
			"https://cal/dispatch",
			expect.stringMatching(/\.ics$/),
			expect.stringContaining("SUMMARY:Write report"),
		);
		expect(inserts[0]?.row).toMatchObject({
			calendar_name: "Dispatch",
			title: "Write report",
			source: "created_here",
		});
		expect(result).toMatchObject({ title: "Write report" });
	});

	it("throws a ServiceError when the named calendar doesn't exist", async () => {
		const { sb } = stubSupabase();
		const conn = fakeConn({
			listCalendars: vi.fn(async () => [{ displayName: "Home", url: "https://cal/home" }]),
		});

		await expect(
			createEventHere(sb, conn, {
				title: "Write report",
				startUtc: "2026-07-20T13:00:00.000Z",
				endUtc: "2026-07-20T14:00:00.000Z",
			}),
		).rejects.toBeInstanceOf(ServiceError);
	});
});
