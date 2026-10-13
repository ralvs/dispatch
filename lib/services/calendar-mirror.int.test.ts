import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/invalidate", async (original) => ({
	...(await original<typeof import("@/lib/invalidate")>()),
	afterExternalMutation: vi.fn(),
}));

import type { CalendarEventSource } from "@/lib/schemas/calendar";
import {
	type MirrorEvent,
	type MirrorSnapshot,
	readCalendarSyncStates,
	syncFeed,
} from "@/lib/services/calendar-mirror";
import { serviceClient } from "@/test/integration/clients";

// The calendar mirror against the real tables (docs/adr/0086), driven with
// hand-built snapshots: the adapters are tested on their own.

const NOW_MS = Date.parse("2026-07-16T12:00:00.000Z");
const WINDOW = { startUtc: "2026-07-10T00:00:00.000Z", endUtc: "2026-07-24T00:00:00.000Z" };

function event(overrides: Partial<MirrorEvent> = {}): MirrorEvent {
	return {
		uid: "evt-1",
		etag: "etag-1",
		href: null,
		calendarName: "Home",
		title: "Dentist",
		description: null,
		location: null,
		startUtc: "2026-07-16T14:00:00.000Z",
		endUtc: "2026-07-16T15:00:00.000Z",
		allDay: false,
		attendees: [],
		recurring: false,
		...overrides,
	};
}

function snapshot(overrides: Partial<MirrorSnapshot> = {}): MirrorSnapshot {
	return { window: WINDOW, events: [], calendars: "all", trustEmpty: false, ...overrides };
}

async function insertRow(row: {
	caldav_uid: string;
	source: CalendarEventSource;
	calendar_name?: string;
	start_at?: string;
	synced_at?: string;
}) {
	const { error } = await serviceClient()
		.from("calendar_events")
		.insert({
			title: row.caldav_uid,
			calendar_name: "Home",
			start_at: "2026-07-17T14:00:00Z",
			end_at: "2026-07-17T15:00:00Z",
			synced_at: "2026-07-01T00:00:00Z",
			...row,
		});
	if (error) throw error;
}

async function uids() {
	const { data, error } = await serviceClient()
		.from("calendar_events")
		.select("caldav_uid")
		.order("caldav_uid");
	if (error) throw error;
	return data.map((r) => r.caldav_uid);
}

async function alerts(type: string) {
	const { data, error } = await serviceClient()
		.from("notifications")
		.select("status")
		.eq("type", type);
	if (error) throw error;
	return data.map((r) => r.status);
}

const sync = (feed: "icloud" | "work", snap: MirrorSnapshot | Error) =>
	syncFeed(
		serviceClient(),
		feed,
		async () => {
			if (snap instanceof Error) throw snap;
			return snap;
		},
		{ nowMs: NOW_MS },
	);

describe("syncFeed against the local database", () => {
	it("clears the feed's rows in the window when an empty snapshot is trusted", async () => {
		await insertRow({ caldav_uid: "work-in", source: "google" });
		await insertRow({ caldav_uid: "work-out", source: "google", start_at: "2026-08-10T14:00:00Z" });
		await insertRow({ caldav_uid: "home-in", source: "caldav" });

		expect(await sync("work", snapshot({ trustEmpty: true }))).toEqual({
			ok: true,
			pulled: 0,
			removed: 1,
		});
		expect(await uids()).toEqual(["home-in", "work-out"]);
	});

	it("deletes nothing on an empty snapshot that is not trusted", async () => {
		await insertRow({ caldav_uid: "home-in", source: "caldav" });

		expect(await sync("icloud", snapshot())).toEqual({ ok: true, pulled: 0, removed: 0 });
		expect(await uids()).toEqual(["home-in"]);
	});

	it("compares only the calendars the snapshot speaks for", async () => {
		await insertRow({ caldav_uid: "home-gone", source: "caldav" });
		await insertRow({ caldav_uid: "work-gone", source: "caldav", calendar_name: "Work" });

		const result = await sync("icloud", snapshot({ events: [event()], calendars: ["Home"] }));
		expect(result).toEqual({ ok: true, pulled: 1, removed: 1 });
		expect(await uids()).toEqual(["evt-1", "work-gone"]);
	});

	it("never deletes a row written after the sync began", async () => {
		await insertRow({ caldav_uid: "fresh", source: "caldav", synced_at: "2026-07-16T12:00:00Z" });

		const result = await sync("icloud", snapshot({ events: [event()], calendars: ["Home"] }));
		expect(result).toEqual({ ok: true, pulled: 1, removed: 0 });
		expect(await uids()).toEqual(["evt-1", "fresh"]);
	});

	it("a trusted empty snapshot still keeps a row written after the sync began", async () => {
		await insertRow({ caldav_uid: "fresh", source: "google", synced_at: "2026-07-16T12:00:00Z" });

		expect(await sync("work", snapshot({ trustEmpty: true }))).toEqual({
			ok: true,
			pulled: 0,
			removed: 0,
		});
		expect(await uids()).toEqual(["fresh"]);
	});

	it("ignores events outside the window", async () => {
		const outside = event({
			uid: "late",
			startUtc: "2026-08-01T14:00:00.000Z",
			endUtc: "2026-08-01T15:00:00.000Z",
		});

		expect(await sync("icloud", snapshot({ events: [outside, event()] }))).toEqual({
			ok: true,
			pulled: 1,
			removed: 0,
		});
		expect(await uids()).toEqual(["evt-1"]);
	});

	it("records a failed read: no events, an error state, one unread alert", async () => {
		expect(await sync("icloud", new Error("network down"))).toEqual({
			ok: false,
			error: "network down",
		});
		expect(await uids()).toEqual([]);
		const { icloud } = await readCalendarSyncStates(serviceClient());
		expect(icloud?.last_result).toEqual({ error: "network down" });
		expect(await alerts("caldav.sync_failed")).toEqual(["unread"]);
	});

	it("announces an outage once: a second failure only updates the state", async () => {
		await sync("work", new Error("first"));
		await sync("work", new Error("second"));

		const { work } = await readCalendarSyncStates(serviceClient());
		expect(work?.last_result).toEqual({ error: "second", via: "eventkit_bridge" });
		expect(await alerts("gcal.sync_failed")).toEqual(["unread"]);
	});

	it("a success after a failure marks the alert read and records the counts", async () => {
		await sync("work", new Error("down"));

		expect(await sync("work", snapshot({ events: [event()], trustEmpty: true }))).toEqual({
			ok: true,
			pulled: 1,
			removed: 0,
		});
		const { work } = await readCalendarSyncStates(serviceClient());
		expect(work?.last_result).toEqual({ pulled: 1, removed: 0, via: "eventkit_bridge" });
		expect(await alerts("gcal.sync_failed")).toEqual(["read"]);
	});

	it("a new outage after a success is announced again", async () => {
		await sync("work", new Error("down"));
		await sync("work", snapshot({ trustEmpty: true }));
		await sync("work", new Error("down again"));

		expect((await alerts("gcal.sync_failed")).sort()).toEqual(["read", "unread"]);
	});

	it("retries the alert when the last failure could not announce it", async () => {
		const { error } = await serviceClient()
			.from("google_sync_state")
			.upsert(
				{
					id: true,
					last_synced_at: "2026-07-16T11:00:00Z",
					last_result: { error: "down", via: "eventkit_bridge", announced: false },
				},
				{ onConflict: "id" },
			);
		if (error) throw error;

		await sync("work", new Error("still down"));

		expect(await alerts("gcal.sync_failed")).toEqual(["unread"]);
		const { work } = await readCalendarSyncStates(serviceClient());
		expect(work?.last_result).toEqual({ error: "still down", via: "eventkit_bridge" });
	});
});
