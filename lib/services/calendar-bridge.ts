import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nowUtc } from "@/lib/dates";
import type { BridgeEvent } from "@/lib/schemas/calendar";
import { ServiceError, unwrap } from "@/lib/services/errors";

// ─────────────────────────────────────────────────────────────────────────
// Mac EventKit bridge ingest (docs/adr/0018). Replaces Google OAuth: the Mac
// reads calendars already synced into Apple Calendar and POSTs a windowed
// snapshot. source='google' (work events); set-difference delete like CalDAV.
// ─────────────────────────────────────────────────────────────────────────

function inListLiteral(values: Iterable<string>): string {
	return `(${[...values].map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")})`;
}

export type BridgeSyncInput = {
	events: BridgeEvent[];
	windowStart: string;
	windowEnd: string;
};

export async function syncBridgeEvents(
	sb: SupabaseClient,
	input: BridgeSyncInput,
): Promise<{ pulled: number; removed: number }> {
	const windowStartMs = Date.parse(input.windowStart);
	const windowEndMs = Date.parse(input.windowEnd);
	if (
		!Number.isFinite(windowStartMs) ||
		!Number.isFinite(windowEndMs) ||
		windowStartMs >= windowEndMs
	) {
		throw new ServiceError("Invalid bridge window", "INVALID");
	}

	const syncedAt = nowUtc();
	const existingRows = (unwrap(
		await sb
			.from("calendar_events")
			.select("caldav_uid, caldav_etag, start_at, calendar_name")
			.eq("source", "google"),
	) ?? []) as {
		caldav_uid: string | null;
		caldav_etag: string | null;
		start_at: string;
		calendar_name: string | null;
	}[];
	const knownByUid = new Map(
		existingRows.filter((r) => r.caldav_uid !== null).map((r) => [r.caldav_uid as string, r]),
	);

	let pulled = 0;
	const seenUids = new Set<string>();

	for (const event of input.events) {
		const startMs = Date.parse(event.start_at);
		const endMs = Date.parse(event.end_at);
		if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
		// Bound the set-difference window to the declared range.
		if (endMs <= windowStartMs || startMs >= windowEndMs) continue;

		seenUids.add(event.uid);
		const etag = event.etag ?? `${event.start_at}|${event.end_at}|${event.title}`;
		const known = knownByUid.get(event.uid);
		if (
			known &&
			known.caldav_etag === etag &&
			Date.parse(known.start_at) === Date.parse(event.start_at) &&
			known.calendar_name === event.calendar_name
		) {
			continue;
		}

		unwrap(
			await sb.from("calendar_events").upsert(
				{
					caldav_uid: event.uid,
					caldav_etag: etag,
					caldav_href: null,
					calendar_name: event.calendar_name,
					title: event.title,
					description: event.description ?? null,
					start_at: event.start_at,
					end_at: event.end_at,
					all_day: event.all_day,
					location: event.location ?? null,
					attendees: [],
					source: "google",
					synced_at: syncedAt,
				},
				{ onConflict: "source,caldav_uid" },
			),
		);
		pulled++;
	}

	// Bridge is the source of truth for source=google. An authenticated empty
	// snapshot intentionally clears the window (unlike CalDAV's failed-fetch guard).
	let removed = 0;
	if (seenUids.size === 0) {
		const deleted = unwrap(
			await sb
				.from("calendar_events")
				.delete()
				.eq("source", "google")
				.gte("start_at", input.windowStart)
				.lt("start_at", input.windowEnd)
				.select("id"),
		);
		removed = ((deleted as unknown[] | null) ?? []).length;
	} else {
		const deleted = unwrap(
			await sb
				.from("calendar_events")
				.delete()
				.eq("source", "google")
				.gte("start_at", input.windowStart)
				.lt("start_at", input.windowEnd)
				.not("caldav_uid", "in", inListLiteral(seenUids))
				.select("id"),
		);
		removed = ((deleted as unknown[] | null) ?? []).length;
	}

	unwrap(
		await sb.from("google_sync_state").upsert(
			{
				id: true,
				last_synced_at: syncedAt,
				last_result: { pulled, removed, via: "eventkit_bridge" },
			},
			{ onConflict: "id" },
		),
	);

	return { pulled, removed };
}
