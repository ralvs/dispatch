"use server";

import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { clearSkipsToday, recordQuoteSkip } from "@/lib/services/resurfacing";
import { todayForRequest } from "@/lib/services/settings";

/** "Next →" on the Resurfaced card: skip today's pick, advance the rotation. */
export async function skipResurfacedQuoteAction(quoteId: string) {
	const { sb } = await requireOwnerPage();
	await recordQuoteSkip(sb, z.uuid().parse(quoteId), await todayForRequest(sb));
	afterMutation("today.only");
}

/** "Reset" on the Resurfaced card: forget today's skips. */
export async function resetResurfacedAction() {
	const { sb } = await requireOwnerPage();
	await clearSkipsToday(sb, await todayForRequest(sb));
	afterMutation("today.only");
}
