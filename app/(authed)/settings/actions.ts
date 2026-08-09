"use server";

import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { updateAppTimezone, updateReminderSettings } from "@/lib/services/settings";

export async function updateTimezoneAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	await updateAppTimezone(sb, z.string().min(1).parse(formData.get("timezone")));
	// Every page derives its day boundary from this one value.
	afterMutation("settings.timezone");
}

export async function updateReminderSettingsAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const offsetMinutes = z.coerce
		.number()
		.int()
		.min(0)
		.max(2880)
		.parse(formData.get("reminder_offset_minutes"));
	const anchorTime = z.string().min(1).parse(formData.get("reminder_anchor_time"));
	await updateReminderSettings(sb, { offsetMinutes, anchorTime });
	afterMutation("settings.reminders");
}
