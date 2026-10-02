"use server";

import { requireOwnerPage } from "@/lib/auth";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { nowUtc, todayInTz } from "@/lib/dates";
import { afterMutation } from "@/lib/invalidate";
import { CaptureRequestSchema } from "@/lib/schemas/capture";
import { type CapturedRecord, capture, capturedRows } from "@/lib/services/capture";
import type { Received } from "@/lib/store/receive";

/**
 * What the palette gets back: the record its receipt reads, and the rows the
 * capture wrote, for the entity store (docs/adr/0069). `received` is null when
 * the capture booked a calendar event, which the store does not hold: then
 * the action reads its own write with a page render instead.
 */
export type CaptureAnswer = { record: CapturedRecord; received: Received | null };

/**
 * Palette (Cmd+J) capture entry point. User-initiated, so it runs under the
 * RLS client returned by requireOwnerPage(). It writes no ledger row of its
 * own, but one parsed action does: create_event puts an event on the external
 * calendar, and the executor records that (iron rule #6). So this busts
 * notification.write as well as the capture's own tags.
 *
 * The raw text is validated then handed to capture(), which persists it before
 * doing anything else, so a parse/execute failure never loses the input.
 *
 * UI shows a provisional "Recorded" receipt immediately (capture machine);
 * this SA still runs the full pipeline, and the palette confirms its rows.
 */
export async function captureText(input: {
	text: string;
	via?: "voice" | "text";
	client_time?: string;
}): Promise<CaptureAnswer> {
	const { sb } = await requireOwnerPage();
	const parsed = CaptureRequestSchema.parse(input);
	const tz = await getCachedAppTimezone();
	// Stamped before the capture starts, like a seed's (lib/store/server.ts).
	const readAt = nowUtc();
	const record = await capture(sb, {
		kind: "transcript",
		text: parsed.text,
		via: parsed.via ?? "text",
		clientTime: parsed.client_time,
	});

	const rows = capturedRows(record);
	afterMutation(rows ? "capture.settled" : "capture.event");
	afterMutation("notification.write");
	// `at` after every write committed, like any write's stamp.
	return {
		record,
		received: rows && { readAt, todayIso: todayInTz(tz), tz, at: nowUtc(), rows },
	};
}
