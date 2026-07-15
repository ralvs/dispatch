"use server";

import { requireOwnerPage } from "@/lib/auth";
import { CaptureRequestSchema } from "@/lib/schemas/capture";
import { type CapturedRecord, capture } from "@/lib/services/capture";

/**
 * Palette (Cmd+J) capture entry point. User-initiated, so it runs under the
 * RLS client returned by requireOwnerPage() and writes NO notification ledger
 * row — the ledger is for autonomous/external actions (iron rule #6). External
 * ingest is deferred (docs/adr/0008).
 *
 * The raw text is validated then handed to capture(), which persists it before
 * doing anything else, so a parse/execute failure never loses the input.
 */
export async function captureText(input: {
	text: string;
	via?: "voice" | "text";
	client_time?: string;
}): Promise<CapturedRecord> {
	const { sb } = await requireOwnerPage();
	const parsed = CaptureRequestSchema.parse(input);
	return capture(sb, {
		kind: "transcript",
		text: parsed.text,
		via: parsed.via ?? "voice",
		clientTime: parsed.client_time,
	});
}
