import "server-only";
import type { BridgeEvent } from "@/lib/schemas/calendar";
import { type MirrorResult, syncFeed } from "@/lib/services/calendar-mirror";
import { ServiceError } from "@/lib/services/errors";
import type { SupabaseClient } from "@/lib/supabase/types";

// ─────────────────────────────────────────────────────────────────────────
// Mac EventKit bridge adapter (docs/adr/0018, docs/adr/0086). Replaces Google
// OAuth: the Mac reads calendars already synced into Apple Calendar and POSTs
// a windowed snapshot of the work feed (source='google'). The snapshot is the
// truth for its window — an empty one clears it — and the calendar mirror
// reconciles it and keeps `google_sync_state`.
// ─────────────────────────────────────────────────────────────────────────

export type BridgeSyncInput = {
	events: BridgeEvent[];
	windowStart: string;
	windowEnd: string;
};

export async function syncBridgeEvents(
	sb: SupabaseClient,
	input: BridgeSyncInput,
): Promise<MirrorResult> {
	return syncFeed(sb, "work", async () => {
		// Inside the read, so a bad window is recorded as a failed sync.
		const windowStartMs = Date.parse(input.windowStart);
		const windowEndMs = Date.parse(input.windowEnd);
		if (
			!Number.isFinite(windowStartMs) ||
			!Number.isFinite(windowEndMs) ||
			windowStartMs >= windowEndMs
		) {
			throw new ServiceError("Invalid bridge window", "INVALID");
		}
		return {
			window: { startUtc: input.windowStart, endUtc: input.windowEnd },
			events: input.events.map((event) => ({
				uid: event.uid,
				etag: event.etag ?? `${event.start_at}|${event.end_at}|${event.title}`,
				href: null,
				calendarName: event.calendar_name,
				title: event.title,
				description: event.description ?? null,
				location: event.location ?? null,
				startUtc: event.start_at,
				endUtc: event.end_at,
				allDay: event.all_day,
				attendees: [],
				recurring: null,
			})),
			calendars: "all",
			trustEmpty: true,
		};
	});
}
