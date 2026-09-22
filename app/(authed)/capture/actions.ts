"use server";

import { requireOwnerPage } from "@/lib/auth";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { CaptureRequestSchema } from "@/lib/schemas/capture";
import { type CapturedRecord, capture } from "@/lib/services/capture";

/**
 * Palette (Cmd+J) capture entry point. User-initiated, so it runs under the
 * RLS client returned by requireOwnerPage(). It writes no ledger row of its
 * own, but one parsed action does: create_event puts an event on the external
 * calendar, and the executor records that (iron rule #6). So this busts
 * notification.write as well as capture.settled.
 *
 * The raw text is validated then handed to capture(), which persists it before
 * doing anything else, so a parse/execute failure never loses the input.
 *
 * UI shows a provisional "Recorded" receipt immediately (capture machine);
 * this SA still runs the full pipeline and revalidates on settle.
 */
export async function captureText(input: {
	text: string;
	via?: "voice" | "text";
	client_time?: string;
}): Promise<CapturedRecord> {
	const { sb } = await requireOwnerPage();
	const parsed = CaptureRequestSchema.parse(input);
	const record = await capture(sb, {
		kind: "transcript",
		text: parsed.text,
		via: parsed.via ?? "text",
		clientTime: parsed.client_time,
	});

	afterMutation("capture.settled");
	afterMutation("notification.write");
	return record;
}
