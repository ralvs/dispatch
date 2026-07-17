"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { clearSkipsToday, recordQuoteSkip } from "@/lib/services/resurfacing";
import { getAppTimezone } from "@/lib/services/settings";

/** "Next →" on the Resurfaced card: skip today's pick, advance the rotation. */
export async function skipResurfacedQuoteAction(quoteId: string) {
	const { sb } = await requireOwnerPage();
	const tz = await getAppTimezone(sb);
	await recordQuoteSkip(sb, z.uuid().parse(quoteId), todayInTz(tz));
	revalidatePath("/today");
}

/** "Reset" on the Resurfaced card: forget today's skips. */
export async function resetResurfacedAction() {
	const { sb } = await requireOwnerPage();
	const tz = await getAppTimezone(sb);
	await clearSkipsToday(sb, todayInTz(tz));
	revalidatePath("/today");
}
