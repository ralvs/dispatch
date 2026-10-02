import { describe, expect, it, vi } from "vitest";
import type { CaldavConnection } from "@/lib/caldav/client";

vi.mock("@/lib/env", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/env")>();
	return { ...actual, env: () => ({ ...actual.env(), ICLOUD_CALENDAR_NAME: "Dispatch" }) };
});

import { createEventHere, listEventsOn, syncCalendar } from "@/lib/services/calendar";
import { ServiceError } from "@/lib/services/errors";
import { ownerClient, serviceClient } from "@/test/integration/clients";

// iCloud CalDAV sync against the real tables (#18). The CalDAV server is
// faked — it is the external edge. The database is not. Sync runs under the
// service client, like app/api/cron/caldav/route.ts: caldav_sync_state has RLS
// on and no policy.

const NOW_MS = Date.parse("2026-07-16T12:00:00.000Z");

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

/** A CalDAV server holding the one event above. */
function connWithEvent(etag = "etag-1"): CaldavConnection {
	return fakeConn({
		fetchObjectsInWindow: vi.fn(async () => [
			{ href: "https://cal/home/evt-1.ics", etag, data: ICS_ONE_EVENT },
		]),
	});
}

async function insertEvent(row: {
	caldav_uid: string;
	start_at: string;
	end_at: string;
	source?: string;
	caldav_etag?: string;
	title?: string;
	all_day?: boolean;
}) {
	const { data, error } = await serviceClient()
		.from("calendar_events")
		.insert({ title: row.caldav_uid, ...row })
		.select("id")
		.single();
	if (error) throw error;
	return data.id as string;
}

async function caldavRows() {
	const { data, error } = await serviceClient()
		.from("calendar_events")
		.select("caldav_uid, caldav_etag, calendar_name, title, start_at, source")
		.eq("source", "caldav")
		.order("caldav_uid");
	if (error) throw error;
	return data;
}

async function syncState() {
	const { data, error } = await serviceClient()
		.from("caldav_sync_state")
		.select("last_synced_at, last_result")
		.maybeSingle();
	if (error) throw error;
	return data;
}

describe("syncCalendar against the local database", () => {
	it("stores a pulled event as source caldav and records the run", async () => {
		const result = await syncCalendar(serviceClient(), connWithEvent(), { nowMs: NOW_MS });

		expect(result).toEqual({ pulled: 1, removed: 0 });
		expect(await caldavRows()).toMatchObject([
			{
				caldav_uid: "evt-1@icloud.com",
				caldav_etag: "etag-1",
				calendar_name: "Home",
				title: "Dentist",
				start_at: "2026-07-16T14:00:00+00:00",
			},
		]);
		expect(await syncState()).toMatchObject({ last_result: { pulled: 1, removed: 0 } });
	});

	it("writes nothing for an event with the same etag and start", async () => {
		const sb = serviceClient();
		await syncCalendar(sb, connWithEvent(), { nowMs: NOW_MS });

		expect(await syncCalendar(sb, connWithEvent(), { nowMs: NOW_MS })).toEqual({
			pulled: 0,
			removed: 0,
		});
		expect(await caldavRows()).toHaveLength(1);
	});

	it("rewrites an event whose etag matches but whose start moved (a recurring event)", async () => {
		await insertEvent({
			caldav_uid: "evt-1@icloud.com",
			caldav_etag: "etag-1",
			start_at: "2026-07-09T14:00:00Z",
			end_at: "2026-07-09T15:00:00Z",
			source: "caldav",
		});

		const result = await syncCalendar(serviceClient(), connWithEvent(), { nowMs: NOW_MS });

		expect(result.pulled).toBe(1);
		expect(await caldavRows()).toMatchObject([
			{ caldav_uid: "evt-1@icloud.com", start_at: "2026-07-16T14:00:00+00:00" },
		]);
	});

	it("deletes only in-window caldav rows the server no longer has", async () => {
		await insertEvent({
			caldav_uid: "gone@icloud.com",
			start_at: "2026-07-17T14:00:00Z",
			end_at: "2026-07-17T15:00:00Z",
		});
		// Outside the ±21-day window: not compared, so kept.
		await insertEvent({
			caldav_uid: "old@icloud.com",
			start_at: "2026-05-01T14:00:00Z",
			end_at: "2026-05-01T15:00:00Z",
		});
		// Another source: not CalDAV's to delete.
		await insertEvent({
			caldav_uid: "work@engine",
			start_at: "2026-07-17T14:00:00Z",
			end_at: "2026-07-17T15:00:00Z",
			source: "google",
		});

		const result = await syncCalendar(serviceClient(), connWithEvent(), { nowMs: NOW_MS });

		expect(result.removed).toBe(1);
		expect((await caldavRows()).map((r) => r.caldav_uid)).toEqual([
			"evt-1@icloud.com",
			"old@icloud.com",
		]);
		const { data } = await serviceClient()
			.from("calendar_events")
			.select("id")
			.eq("source", "google");
		expect(data).toHaveLength(1);
	});

	it("throws and deletes nothing when every calendar fetch fails", async () => {
		await insertEvent({
			caldav_uid: "kept@icloud.com",
			start_at: "2026-07-17T14:00:00Z",
			end_at: "2026-07-17T15:00:00Z",
		});
		const before = await syncState();
		const conn = fakeConn({
			fetchObjectsInWindow: vi.fn(async () => {
				throw new Error("network down");
			}),
		});

		await expect(syncCalendar(serviceClient(), conn, { nowMs: NOW_MS })).rejects.toBeInstanceOf(
			ServiceError,
		);
		expect(await caldavRows()).toHaveLength(1);
		expect(await syncState()).toEqual(before);
	});

	it("deletes nothing when the fetches worked but returned no events", async () => {
		await insertEvent({
			caldav_uid: "kept@icloud.com",
			start_at: "2026-07-17T14:00:00Z",
			end_at: "2026-07-17T15:00:00Z",
		});

		expect(await syncCalendar(serviceClient(), fakeConn(), { nowMs: NOW_MS })).toEqual({
			pulled: 0,
			removed: 0,
		});
		expect(await caldavRows()).toHaveLength(1);
	});
});

describe("listEventsOn against the local database", () => {
	it("returns the day's events in order, in the app timezone", async () => {
		// 23:30 in São Paulo on the 15th — the day before.
		await insertEvent({
			caldav_uid: "late-15th",
			start_at: "2026-07-16T02:30:00Z",
			end_at: "2026-07-16T02:45:00Z",
		});
		await insertEvent({
			caldav_uid: "dentist",
			start_at: "2026-07-16T17:00:00Z",
			end_at: "2026-07-16T18:00:00Z",
		});
		// 23:30 in São Paulo on the 16th — the same day, though UTC says the 17th.
		await insertEvent({
			caldav_uid: "late-16th",
			start_at: "2026-07-17T02:30:00Z",
			end_at: "2026-07-17T02:45:00Z",
		});
		// An all-day event for the 16th with no length, at UTC midnight: it ends
		// before the 16th starts in São Paulo, so only the widened query finds it.
		await insertEvent({
			caldav_uid: "all-day-16th",
			start_at: "2026-07-16T00:00:00Z",
			end_at: "2026-07-16T00:00:00Z",
			all_day: true,
		});
		// An all-day event for the 17th: its UTC midnight sits inside the 16th's
		// local window, but it belongs to the 17th.
		await insertEvent({
			caldav_uid: "all-day-17th",
			start_at: "2026-07-17T00:00:00Z",
			end_at: "2026-07-18T00:00:00Z",
			all_day: true,
		});

		const events = await listEventsOn(await ownerClient(), "2026-07-16", "America/Sao_Paulo");

		expect(events.map((e) => e.title)).toEqual(["all-day-16th", "dentist", "late-16th"]);
	});
});

describe("createEventHere against the local database", () => {
	it("pushes to the calendar named by ICLOUD_CALENDAR_NAME and mirrors it as created_here", async () => {
		const createObject = vi.fn(async (_url: string, _name: string, _ics: string) => undefined);
		const conn = fakeConn({
			listCalendars: vi.fn(async () => [
				{ displayName: "Home", url: "https://cal/home" },
				{ displayName: "Dispatch", url: "https://cal/dispatch" },
			]),
			createObject,
		});

		const event = await createEventHere(await ownerClient(), conn, {
			title: "Write report",
			startUtc: "2026-07-20T13:00:00.000Z",
			endUtc: "2026-07-20T14:00:00.000Z",
		});

		expect(createObject).toHaveBeenCalledWith(
			"https://cal/dispatch",
			expect.stringMatching(/\.ics$/),
			expect.stringContaining("SUMMARY:Write report"),
		);
		const { data } = await serviceClient()
			.from("calendar_events")
			.select("title, calendar_name, source, caldav_uid")
			.eq("id", event.id)
			.single();
		expect(data).toMatchObject({
			title: "Write report",
			calendar_name: "Dispatch",
			source: "created_here",
		});
		expect(createObject.mock.calls[0]?.[1]).toBe(`${data?.caldav_uid}.ics`);
	});

	it("throws and stores nothing when the named calendar does not exist", async () => {
		const sb = await ownerClient();

		await expect(
			createEventHere(sb, fakeConn(), {
				title: "Write report",
				startUtc: "2026-07-20T13:00:00.000Z",
				endUtc: "2026-07-20T14:00:00.000Z",
			}),
		).rejects.toBeInstanceOf(ServiceError);
		const { data } = await sb.from("calendar_events").select("id");
		expect(data).toEqual([]);
	});
});
