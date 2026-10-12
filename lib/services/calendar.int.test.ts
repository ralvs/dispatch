import { describe, expect, it, vi } from "vitest";
import type { CaldavConnection } from "@/lib/caldav/client";

vi.mock("@/lib/env", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/env")>();
	return { ...actual, env: () => ({ ...actual.env(), ICLOUD_CALENDAR_NAME: "Renan" }) };
});

import {
	createEventHere,
	deleteEvent,
	listEventsOn,
	syncCalendar,
	updateEvent,
} from "@/lib/services/calendar";
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
		fetchObject: vi.fn(async () => null),
		createObject: vi.fn(async (url: string, name: string) => ({
			href: `${url}/${name}`,
			etag: '"etag-created"',
		})),
		updateObject: vi.fn(async (href: string) => ({ href, etag: '"etag-updated"' })),
		deleteObject: vi.fn(async () => undefined),
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
	caldav_href?: string;
	calendar_name?: string;
	recurring?: boolean | null;
	synced_at?: string;
	title?: string;
	all_day?: boolean;
}) {
	const { data, error } = await serviceClient()
		.from("calendar_events")
		// A synced row: on a calendar, written by a sync before this one ran.
		.insert({
			title: row.caldav_uid,
			calendar_name: "Home",
			synced_at: "2026-07-01T00:00:00Z",
			...row,
		})
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
	it("pushes to the write calendar and mirrors it as created_here, with href and etag", async () => {
		const createObject = vi.fn(async (url: string, name: string, _ics: string) => ({
			href: `${url}/${name}`,
			etag: '"etag-created"',
		}));
		const conn = fakeConn({
			listCalendars: vi.fn(async () => [
				{ displayName: "Home", url: "https://cal/home" },
				{ displayName: "Renan", url: "https://cal/renan" },
			]),
			createObject,
		});

		const event = await createEventHere(await ownerClient(), conn, {
			title: "Write report",
			startUtc: "2026-07-20T13:00:00.000Z",
			endUtc: "2026-07-20T14:00:00.000Z",
		});

		expect(createObject).toHaveBeenCalledWith(
			"https://cal/renan",
			expect.stringMatching(/\.ics$/),
			expect.stringContaining("SUMMARY:Write report"),
		);
		const { data } = await serviceClient()
			.from("calendar_events")
			.select("title, calendar_name, source, caldav_uid, caldav_href, caldav_etag, recurring")
			.eq("id", event.id)
			.single();
		expect(data).toMatchObject({
			title: "Write report",
			calendar_name: "Renan",
			source: "created_here",
			caldav_href: `https://cal/renan/${data?.caldav_uid}.ics`,
			caldav_etag: '"etag-created"',
			recurring: false,
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

// ─── One row per event (#115) ───────────────────────────────────────────

/** iCloud holds what `createEventHere` wrote, on the write calendar. */
function icloudEcho(uid: string, ics: string, etag: string): CaldavConnection {
	return fakeConn({
		listCalendars: vi.fn(async () => [{ displayName: "Renan", url: "https://cal/renan" }]),
		fetchObjectsInWindow: vi.fn(async () => [
			{ href: `https://cal/renan/${uid}.ics`, etag, data: ics },
		]),
	});
}

async function allRows() {
	const { data, error } = await serviceClient()
		.from("calendar_events")
		.select("id, caldav_uid, caldav_etag, source, title, recurring");
	if (error) throw error;
	return data;
}

describe("create, then sync", () => {
	it("keeps one row for the UID: the created_here row, refreshed from iCloud", async () => {
		let written = "";
		const createConn = fakeConn({
			listCalendars: vi.fn(async () => [{ displayName: "Renan", url: "https://cal/renan" }]),
			createObject: vi.fn(async (url: string, name: string, ics: string) => {
				written = ics;
				return { href: `${url}/${name}`, etag: '"etag-created"' };
			}),
		});
		const event = await createEventHere(await ownerClient(), createConn, {
			title: "Write report",
			startUtc: "2026-07-17T13:00:00.000Z",
			endUtc: "2026-07-17T14:00:00.000Z",
		});
		const uid = (await allRows())[0]?.caldav_uid as string;
		// Apple Calendar renamed it, so iCloud now has a new etag.
		const renamed = written.replace("SUMMARY:Write report", "SUMMARY:Write the report");

		const result = await syncCalendar(serviceClient(), icloudEcho(uid, renamed, '"etag-2"'), {
			nowMs: NOW_MS,
		});

		expect(result).toEqual({ pulled: 1, removed: 0 });
		expect(await allRows()).toEqual([
			{
				id: event.id,
				caldav_uid: uid,
				caldav_etag: '"etag-2"',
				source: "created_here",
				title: "Write the report",
				recurring: false,
			},
		]);
	});

	it("drops a created_here row that iCloud no longer has", async () => {
		await insertEvent({
			caldav_uid: "made-here",
			source: "created_here",
			calendar_name: "Renan",
			start_at: "2026-07-17T14:00:00Z",
			end_at: "2026-07-17T15:00:00Z",
			synced_at: "2026-07-15T00:00:00Z",
		});
		const conn = fakeConn({
			listCalendars: vi.fn(async () => [{ displayName: "Renan", url: "https://cal/renan" }]),
			fetchObjectsInWindow: vi.fn(async () => [
				{ href: "https://cal/renan/evt-1.ics", etag: "etag-1", data: ICS_ONE_EVENT },
			]),
		});

		const result = await syncCalendar(serviceClient(), conn, { nowMs: NOW_MS });

		expect(result.removed).toBe(1);
		expect((await allRows()).map((r) => r.caldav_uid)).toEqual(["evt-1@icloud.com"]);
	});

	it("keeps the rows of a calendar whose fetch failed", async () => {
		await insertEvent({
			caldav_uid: "on-renan",
			calendar_name: "Renan",
			start_at: "2026-07-17T14:00:00Z",
			end_at: "2026-07-17T15:00:00Z",
		});
		const conn = fakeConn({
			listCalendars: vi.fn(async () => [
				{ displayName: "Home", url: "https://cal/home" },
				{ displayName: "Renan", url: "https://cal/renan" },
			]),
			fetchObjectsInWindow: vi.fn(async (url: string) => {
				if (url === "https://cal/renan") throw new Error("timeout");
				return [{ href: "https://cal/home/evt-1.ics", etag: "etag-1", data: ICS_ONE_EVENT }];
			}),
		});

		expect((await syncCalendar(serviceClient(), conn, { nowMs: NOW_MS })).removed).toBe(0);
		expect((await allRows()).map((r) => r.caldav_uid).sort()).toEqual([
			"evt-1@icloud.com",
			"on-renan",
		]);
	});

	it("drops a caldav twin of a created_here row", async () => {
		await insertEvent({
			caldav_uid: "evt-1@icloud.com",
			source: "created_here",
			caldav_etag: "etag-1",
			recurring: false,
			start_at: "2026-07-16T14:00:00Z",
			end_at: "2026-07-16T15:00:00Z",
		});
		// Written by a sync that read the known rows before the create committed.
		await insertEvent({
			caldav_uid: "evt-1@icloud.com",
			source: "caldav",
			caldav_etag: "etag-1",
			recurring: false,
			start_at: "2026-07-16T14:00:00Z",
			end_at: "2026-07-16T15:00:00Z",
		});

		await syncCalendar(serviceClient(), connWithEvent(), { nowMs: NOW_MS });

		expect((await allRows()).map((r) => r.source)).toEqual(["created_here"]);
	});

	it("rewrites an unchanged row once to learn whether it repeats", async () => {
		await insertEvent({
			caldav_uid: "evt-1@icloud.com",
			caldav_etag: "etag-1",
			start_at: "2026-07-16T14:00:00Z",
			end_at: "2026-07-16T15:00:00Z",
			source: "caldav",
			recurring: null,
		});

		const sb = serviceClient();
		expect((await syncCalendar(sb, connWithEvent(), { nowMs: NOW_MS })).pulled).toBe(1);
		expect((await allRows())[0]?.recurring).toBe(false);
		expect((await syncCalendar(sb, connWithEvent(), { nowMs: NOW_MS })).pulled).toBe(0);
	});
});

// ─── Edit and delete on iCloud (#115) ───────────────────────────────────

const RENAN_ICS = [
	"BEGIN:VCALENDAR",
	"VERSION:2.0",
	"BEGIN:VEVENT",
	"UID:r-1",
	"DTSTAMP:20260701T000000Z",
	"DTSTART:20260716T140000Z",
	"DTEND:20260716T150000Z",
	"SUMMARY:Dentist",
	"BEGIN:VALARM",
	"ACTION:DISPLAY",
	"TRIGGER:-PT15M",
	"END:VALARM",
	"END:VEVENT",
	"END:VCALENDAR",
].join("\r\n");
const HREF = "https://cal/renan/r-1.ics";

async function insertOnRenan(
	overrides: { source?: string; calendar_name?: string; recurring?: boolean | null } = {},
) {
	return insertEvent({
		caldav_uid: "r-1",
		title: "Dentist",
		caldav_href: HREF,
		caldav_etag: '"etag-1"',
		calendar_name: "Renan",
		recurring: false,
		source: "caldav",
		start_at: "2026-07-16T14:00:00Z",
		end_at: "2026-07-16T15:00:00Z",
		...overrides,
	});
}

function editConn(overrides: Partial<CaldavConnection> = {}) {
	return fakeConn({
		fetchObject: vi.fn(async () => ({ href: HREF, etag: '"etag-1"', data: RENAN_ICS })),
		...overrides,
	});
}

describe("updateEvent against the local database", () => {
	it("patches the iCloud copy under If-Match, then the row", async () => {
		const id = await insertOnRenan();
		const updateObject = vi.fn(async (href: string, _ics: string, _etag: string) => ({
			href,
			etag: '"etag-2"',
		}));

		const event = await updateEvent(await ownerClient(), editConn({ updateObject }), id, {
			title: "Dentist, moved",
			startUtc: "2026-07-17T14:00:00.000Z",
			location: "Clinic",
		});

		expect(updateObject).toHaveBeenCalledWith(HREF, expect.any(String), '"etag-1"');
		const sent = updateObject.mock.calls[0]?.[1] ?? "";
		expect(sent).toContain("SUMMARY:Dentist\\, moved");
		expect(sent).toContain("BEGIN:VALARM");
		expect(event).toMatchObject({
			title: "Dentist, moved",
			location: "Clinic",
			start_at: "2026-07-17T14:00:00+00:00",
			end_at: "2026-07-17T15:00:00+00:00",
		});
		const { data } = await serviceClient()
			.from("calendar_events")
			.select("caldav_etag")
			.eq("id", id)
			.single();
		expect(data?.caldav_etag).toBe('"etag-2"');
	});

	it("refuses with CONFLICT when iCloud changed since the last sync, and writes nothing", async () => {
		const id = await insertOnRenan();
		const updateObject = vi.fn();
		const conn = editConn({
			fetchObject: vi.fn(async () => ({ href: HREF, etag: '"etag-9"', data: RENAN_ICS })),
			updateObject,
		});

		await expect(updateEvent(await ownerClient(), conn, id, { title: "x" })).rejects.toMatchObject({
			code: "CONFLICT",
		});
		expect(updateObject).not.toHaveBeenCalled();
		expect((await allRows())[0]?.title).toBe("Dentist");
	});

	it("leaves the row alone when the iCloud write fails", async () => {
		const id = await insertOnRenan();
		const conn = editConn({
			updateObject: vi.fn(async () => {
				throw new ServiceError("changed", "CONFLICT");
			}),
		});

		await expect(updateEvent(await ownerClient(), conn, id, { title: "x" })).rejects.toMatchObject({
			code: "CONFLICT",
		});
		expect((await allRows())[0]?.title).toBe("Dentist");
	});

	it.each([
		["a work event", { source: "google" }],
		["an event on another calendar", { calendar_name: "Nivers" }],
		["a series", { recurring: true }],
		["an event not synced yet", { recurring: null }],
	])("refuses %s without reaching iCloud", async (_label, overrides) => {
		const id = await insertOnRenan(overrides);
		const conn = editConn();

		await expect(updateEvent(await ownerClient(), conn, id, { title: "x" })).rejects.toMatchObject({
			code: "NOT_EDITABLE",
		});
		expect(conn.fetchObject).not.toHaveBeenCalled();
	});
});

describe("deleteEvent against the local database", () => {
	it("deletes on iCloud under If-Match, then the row, and answers with the row", async () => {
		const id = await insertOnRenan();
		const conn = editConn();

		const event = await deleteEvent(await ownerClient(), conn, id);

		expect(conn.deleteObject).toHaveBeenCalledWith(HREF, '"etag-1"');
		expect(event).toMatchObject({ id, title: "Dentist", calendar_name: "Renan" });
		expect(await allRows()).toEqual([]);
	});

	it("keeps the row when iCloud refuses the delete", async () => {
		const id = await insertOnRenan();
		const conn = editConn({
			deleteObject: vi.fn(async () => {
				throw new ServiceError("changed", "CONFLICT");
			}),
		});

		await expect(deleteEvent(await ownerClient(), conn, id)).rejects.toMatchObject({
			code: "CONFLICT",
		});
		expect(await allRows()).toHaveLength(1);
	});

	it.each([
		["a work event", { source: "google" }],
		["an event on another calendar", { calendar_name: "Nivers" }],
		["a series", { recurring: true }],
	])("refuses %s without reaching iCloud", async (_label, overrides) => {
		const id = await insertOnRenan(overrides);
		const conn = editConn();

		await expect(deleteEvent(await ownerClient(), conn, id)).rejects.toMatchObject({
			code: "NOT_EDITABLE",
		});
		expect(conn.deleteObject).not.toHaveBeenCalled();
	});
});
