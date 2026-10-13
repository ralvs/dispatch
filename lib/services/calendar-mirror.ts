import "server-only";
import { type CalendarFeed, type SyncState, syncFailure } from "@/lib/calendar-health";
import type { Database } from "@/lib/database";
import { nowUtc } from "@/lib/dates";
import { unwrap } from "@/lib/services/errors";
import { inListLiteral } from "@/lib/services/in-list";
import { recordNotification, resolveAlerts } from "@/lib/services/notifications";
import type { SupabaseClient } from "@/lib/supabase/types";

// ─────────────────────────────────────────────────────────────────────────
// One calendar mirror, two source adapters (docs/adr/0086). An adapter —
// iCloud CalDAV (lib/services/calendar.ts) or the Mac EventKit bridge
// (lib/services/calendar-bridge.ts) — only reads its source into a
// `MirrorSnapshot`. This module reconciles the snapshot with the feed's rows
// and writes the feed's sync-state row, on success and on failure. Nothing
// else writes `caldav_sync_state` or `google_sync_state`.
//
// Cancellation is a windowed set-difference on `caldav_uid`: neither source
// has tombstones, so a row inside the window that the snapshot did not carry
// is gone. A failed sync is announced once per outage (working → failed);
// a success marks that feed's unread alerts read (docs/adr/0080).
// ─────────────────────────────────────────────────────────────────────────

export type MirrorEvent = {
	uid: string;
	etag: string;
	href: string | null;
	calendarName: string;
	title: string;
	description: string | null;
	location: string | null;
	startUtc: string;
	endUtc: string;
	allDay: boolean;
	attendees: string[];
	/** A series row? null when the source cannot tell (the bridge). */
	recurring: boolean | null;
};

export type MirrorSnapshot = {
	window: { startUtc: string; endUtc: string };
	events: MirrorEvent[];
	/** Calendars this snapshot speaks for; only their rows are compared. "all": every row of the feed. */
	calendars: readonly string[] | "all";
	/** true: an empty snapshot means the window is empty, so clear it (bridge). false: an empty snapshot compares nothing (CalDAV). */
	trustEmpty: boolean;
};

export type MirrorResult =
	| { ok: true; pulled: number; removed: number }
	| { ok: false; error: string };

type EventInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];

type FeedSpec = {
	stateTable: "caldav_sync_state" | "google_sync_state";
	/** The sources this feed owns. The first is the one new rows are written as. */
	sources: readonly NonNullable<EventInsert["source"]>[];
	failure: { type: string; title: string };
	/** Extra fields stamped on every `last_result`. */
	stamp: Record<string, string>;
};

const FEEDS: Record<CalendarFeed, FeedSpec> = {
	icloud: {
		stateTable: "caldav_sync_state",
		sources: ["caldav", "created_here"],
		failure: { type: "caldav.sync_failed", title: "iCloud calendar sync failed" },
		stamp: {},
	},
	work: {
		stateTable: "google_sync_state",
		sources: ["google"],
		failure: { type: "gcal.sync_failed", title: "Calendar bridge failed" },
		stamp: { via: "eventkit_bridge" },
	},
};

type KnownRow = {
	id: string;
	source: string;
	caldav_uid: string | null;
	caldav_etag: string | null;
	start_at: string;
	calendar_name: string | null;
	recurring: boolean | null;
};

/**
 * Reconcile one feed with what its source holds for a window. Never throws:
 * a failed read or write records `{ error }` on the feed's sync state and
 * answers `{ ok: false }`.
 */
export async function syncFeed(
	sb: SupabaseClient,
	feed: CalendarFeed,
	read: () => Promise<MirrorSnapshot>,
	opts: { nowMs?: number } = {},
): Promise<MirrorResult> {
	const spec = FEEDS[feed];
	// Before the read: a row written after this sync began (an event created
	// meanwhile) is never compared — the read may have run before it existed
	// (docs/adr/0082).
	const syncedAt = nowUtc(opts.nowMs ?? Date.now());

	let pulled: number;
	let removed: number;
	try {
		const snap = await read();
		({ pulled, removed } = await reconcile(sb, spec, snap, syncedAt));
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		await recordFailure(sb, spec, error, syncedAt);
		return { ok: false, error };
	}

	// resolveAlerts is best-effort itself; the catch only keeps the
	// never-throw promise if that ever changes.
	try {
		await resolveAlerts(sb, spec.failure.type);
	} catch (err) {
		console.error("[calendar-mirror] resolving alerts failed", spec.failure.type, err);
	}
	return { ok: true, pulled, removed };
}

async function reconcile(
	sb: SupabaseClient,
	spec: FeedSpec,
	snap: MirrorSnapshot,
	syncedAt: string,
): Promise<{ pulled: number; removed: number }> {
	const windowStartMs = Date.parse(snap.window.startUtc);
	const windowEndMs = Date.parse(snap.window.endUtc);

	// Known rows, so unchanged events (same etag AND same resolved start — a
	// recurring event's start advances as the window slides, etag doesn't)
	// skip their write. Keeps `pulled` meaning "new or changed". A row whose
	// `recurring` is still null is rewritten once, to learn it.
	const existingRows = (unwrap(
		await sb
			.from("calendar_events")
			.select("id, source, caldav_uid, caldav_etag, start_at, calendar_name, recurring")
			.in("source", [...spec.sources]),
	) ?? []) as KnownRow[];
	// An event Dispatch created comes back under the same UID. Its
	// `created_here` row is the one row for it, so a non-primary source wins
	// the UID: the sync updates it in place instead of adding a twin.
	const primary = spec.sources[0];
	const knownByUid = new Map<string, KnownRow>();
	for (const row of existingRows) {
		if (row.caldav_uid === null) continue;
		const held = knownByUid.get(row.caldav_uid);
		if (!held || row.source !== primary) knownByUid.set(row.caldav_uid, row);
	}

	const seen = new Set<string>();
	// One row per uid, the last copy in the snapshot winning — a single upsert
	// cannot touch the same row twice. A last copy that matches the stored row
	// drops an earlier changed copy.
	const changed = new Map<string, MirrorEvent>();
	for (const event of snap.events) {
		const startMs = Date.parse(event.startUtc);
		const endMs = Date.parse(event.endUtc);
		if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
		if (endMs <= windowStartMs || startMs >= windowEndMs) continue;

		seen.add(event.uid);
		const known = knownByUid.get(event.uid);
		if (
			known &&
			known.caldav_etag === event.etag &&
			Date.parse(known.start_at) === startMs &&
			known.calendar_name === event.calendarName &&
			known.recurring === event.recurring
		) {
			changed.delete(event.uid);
			continue;
		}
		changed.set(event.uid, event);
	}

	const upserts: EventInsert[] = [];
	for (const event of changed.values()) {
		const fields = {
			caldav_uid: event.uid,
			caldav_etag: event.etag,
			caldav_href: event.href,
			calendar_name: event.calendarName,
			title: event.title,
			description: event.description,
			start_at: event.startUtc,
			end_at: event.endUtc,
			all_day: event.allDay,
			location: event.location,
			attendees: event.attendees,
			recurring: event.recurring,
			synced_at: syncedAt,
		};
		const known = knownByUid.get(event.uid);
		if (known && known.source !== primary) {
			unwrap(await sb.from("calendar_events").update(fields).eq("id", known.id));
		} else {
			upserts.push({ ...fields, source: primary });
		}
	}
	// One request for every changed event: a request per event made a busy
	// snapshot a long chain of round trips (#96).
	if (upserts.length > 0) {
		unwrap(await sb.from("calendar_events").upsert(upserts, { onConflict: "source,caldav_uid" }));
	}
	const pulled = changed.size;

	// An empty snapshot clears the window only when the source says so: the
	// bridge's authenticated snapshot is the truth, CalDAV's empty one may be
	// a calendar that answered nothing.
	let removed = 0;
	if (seen.size > 0 || snap.trustEmpty) {
		let query = sb
			.from("calendar_events")
			.delete()
			.in("source", [...spec.sources])
			.lt("synced_at", syncedAt)
			.gte("start_at", snap.window.startUtc)
			.lt("start_at", snap.window.endUtc);
		if (snap.calendars !== "all") query = query.in("calendar_name", [...snap.calendars]);
		if (seen.size > 0) query = query.not("caldav_uid", "in", inListLiteral(seen));
		const deleted = unwrap(await query.select("id"));
		removed = ((deleted as unknown[] | null) ?? []).length;
	}

	if (spec.sources.length > 1) await dropTwins(sb, spec);

	unwrap(
		await sb
			.from(spec.stateTable)
			.upsert(
				{ id: true, last_synced_at: syncedAt, last_result: { pulled, removed, ...spec.stamp } },
				{ onConflict: "id" },
			),
	);
	return { pulled, removed };
}

/**
 * A primary-source row whose UID another of the feed's sources holds is a
 * twin: the same event, written by a sync that read the known rows before
 * the create committed. The `created_here` row is the one row (docs/adr/0082).
 */
async function dropTwins(sb: SupabaseClient, spec: FeedSpec): Promise<void> {
	const [primary, ...others] = spec.sources;
	const held = (unwrap(
		await sb
			.from("calendar_events")
			.select("caldav_uid")
			.in("source", others)
			.not("caldav_uid", "is", null),
	) ?? []) as { caldav_uid: string }[];
	if (held.length === 0) return;
	unwrap(
		await sb
			.from("calendar_events")
			.delete()
			.eq("source", primary)
			.in(
				"caldav_uid",
				held.map((r) => r.caldav_uid),
			),
	);
}

/**
 * Record a failed sync — best-effort, never throws. The state row always
 * takes the error; the ledger hears only of working → failed, so an outage
 * is one alert, not one per run. The alert goes first: if it does not land,
 * the state says so (`announced: false`) and the next failed run tries again.
 */
async function recordFailure(
	sb: SupabaseClient,
	spec: FeedSpec,
	error: string,
	syncedAt: string,
): Promise<void> {
	let alreadyAnnounced = false;
	try {
		const prior = unwrap(
			await sb.from(spec.stateTable).select("last_synced_at, last_result").maybeSingle(),
		) as SyncState | null;
		alreadyAnnounced =
			prior !== null &&
			syncFailure(prior.last_result) !== null &&
			(prior.last_result as { announced?: boolean }).announced !== false;
	} catch (err) {
		// Unknown prior state: announce anyway.
		console.error("[calendar-mirror] prior sync state read failed", spec.stateTable, err);
	}
	let announced = true;
	if (!alreadyAnnounced) {
		try {
			announced =
				(await recordNotification(sb, {
					type: spec.failure.type,
					title: spec.failure.title,
					body: error.slice(0, 500),
				})) !== null;
		} catch (err) {
			announced = false;
			console.error("[calendar-mirror] failure alert did not land", spec.failure.type, err);
		}
	}
	try {
		unwrap(
			await sb.from(spec.stateTable).upsert(
				{
					id: true,
					last_synced_at: syncedAt,
					last_result: { error, ...spec.stamp, ...(announced ? {} : { announced: false }) },
				},
				{ onConflict: "id" },
			),
		);
	} catch (err) {
		console.error("[calendar-mirror] failed sync state did not land", spec.stateTable, err);
	}
}

/**
 * Both feeds' sync-state singletons, for Today's calendar health line (#96).
 * Both tables are RLS-on with no policy, so `sb` must be the service client;
 * call it only after the owner check (iron rule #2). A missing row is null.
 */
export async function readCalendarSyncStates(
	sb: SupabaseClient,
): Promise<{ work: SyncState | null; icloud: SyncState | null }> {
	const [work, icloud] = await Promise.all([
		sb.from("google_sync_state").select("last_synced_at, last_result").maybeSingle(),
		sb.from("caldav_sync_state").select("last_synced_at, last_result").maybeSingle(),
	]);
	return {
		work: (unwrap(work) ?? null) as SyncState | null,
		icloud: (unwrap(icloud) ?? null) as SyncState | null,
	};
}
