import { describe, expect, it } from "vitest";
import type { BridgeEvent } from "@/lib/schemas/calendar";
import { readCalendarSyncStates } from "@/lib/services/calendar";
import { syncBridgeEvents } from "@/lib/services/calendar-bridge";
import { ServiceError } from "@/lib/services/errors";
import { serviceClient } from "@/test/integration/clients";

// The Mac EventKit bridge ingest against the real tables (#18). It runs under
// the service client, like app/api/calendar/bridge/route.ts: google_sync_state
// has RLS on and no policy.

const WINDOW = {
	windowStart: "2026-07-14T00:00:00.000Z",
	windowEnd: "2026-07-28T00:00:00.000Z",
};

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

async function sync(events: BridgeEvent[], window = WINDOW) {
	return syncBridgeEvents(serviceClient(), { events, ...window });
}

async function rows(source = "google") {
	const { data, error } = await serviceClient()
		.from("calendar_events")
		.select("caldav_uid, calendar_name, title, start_at, source")
		.eq("source", source)
		.order("caldav_uid");
	if (error) throw error;
	return data;
}

describe("syncBridgeEvents against the local database", () => {
	it("stores new events as source google and records the run", async () => {
		expect(await sync([event()])).toEqual({ pulled: 1, removed: 0 });

		expect(await rows()).toMatchObject([
			{ caldav_uid: "ek-1", calendar_name: "Work", title: "Eng sync" },
		]);
		const { data } = await serviceClient().from("google_sync_state").select("last_result").single();
		expect(data?.last_result).toEqual({ pulled: 1, removed: 0, via: "eventkit_bridge" });
	});

	it("its run is what Today's health line reads for the work feed", async () => {
		expect(await readCalendarSyncStates(serviceClient())).toEqual({ work: null, icloud: null });
		await sync([event()]);

		const { work, icloud } = await readCalendarSyncStates(serviceClient());
		expect(work?.last_synced_at).toEqual(expect.any(String));
		expect(work?.last_result).toEqual({ pulled: 1, removed: 0, via: "eventkit_bridge" });
		expect(icloud).toBeNull();
	});

	it("writes nothing for an unchanged event", async () => {
		await sync([event()]);

		expect(await sync([event()])).toEqual({ pulled: 0, removed: 0 });
	});

	it("stores a batch in one go, and a uid sent twice keeps its last copy", async () => {
		const batch = [
			event(),
			event({ uid: "ek-2", title: "Planning" }),
			event({ uid: "ek-1", title: "Eng sync (moved)", etag: "etag-2" }),
		];

		expect(await sync(batch)).toEqual({ pulled: 2, removed: 0 });
		expect(await rows()).toMatchObject([
			{ caldav_uid: "ek-1", title: "Eng sync (moved)" },
			{ caldav_uid: "ek-2", title: "Planning" },
		]);
	});

	it("a uid whose last copy matches the stored row keeps the stored row", async () => {
		await sync([event()]);

		const batch = [event({ title: "Eng sync (moved)", etag: "etag-2" }), event()];
		expect(await sync(batch)).toEqual({ pulled: 0, removed: 0 });
		expect(await rows()).toMatchObject([{ caldav_uid: "ek-1", title: "Eng sync" }]);
	});

	it("rewrites calendar_name when the Apple calendar is renamed", async () => {
		await sync([event({ calendar_name: "renan.alves@engine.com" })]);

		expect((await sync([event({ calendar_name: "Engine" })])).pulled).toBe(1);
		expect(await rows()).toMatchObject([{ caldav_uid: "ek-1", calendar_name: "Engine" }]);
	});

	it("deletes in-window google rows the snapshot no longer has", async () => {
		await sync([event(), event({ uid: "ek-2" })]);
		// Before the window: the next snapshot does not cover it, so it stays.
		await sync(
			[
				event({
					uid: "ek-old",
					start_at: "2026-07-01T15:00:00.000Z",
					end_at: "2026-07-01T16:00:00.000Z",
				}),
			],
			{
				windowStart: "2026-06-30T00:00:00.000Z",
				windowEnd: "2026-07-14T00:00:00.000Z",
			},
		);

		expect(await sync([event()])).toEqual({ pulled: 0, removed: 1 });
		expect((await rows()).map((r) => r.caldav_uid)).toEqual(["ek-1", "ek-old"]);
	});

	it("clears the window on an empty snapshot, and leaves other sources alone", async () => {
		await sync([event()]);
		// The same meeting as an iCloud invite: same uid, another source.
		const { error } = await serviceClient().from("calendar_events").insert({
			caldav_uid: "ek-1",
			title: "Eng sync",
			start_at: "2026-07-21T15:00:00.000Z",
			end_at: "2026-07-21T16:00:00.000Z",
			source: "caldav",
		});
		if (error) throw error;

		expect(await sync([])).toEqual({ pulled: 0, removed: 1 });
		expect(await rows()).toEqual([]);
		expect(await rows("caldav")).toHaveLength(1);
	});

	it("ignores events outside the declared window", async () => {
		expect(
			await sync([
				event({
					uid: "ek-late",
					start_at: "2026-08-01T15:00:00.000Z",
					end_at: "2026-08-01T16:00:00.000Z",
				}),
			]),
		).toEqual({ pulled: 0, removed: 0 });
		expect(await rows()).toEqual([]);
	});

	it("rejects an inverted window before writing", async () => {
		await expect(
			sync([event()], {
				windowStart: "2026-07-28T00:00:00.000Z",
				windowEnd: "2026-07-14T00:00:00.000Z",
			}),
		).rejects.toBeInstanceOf(ServiceError);
		expect(await rows()).toEqual([]);
	});
});
