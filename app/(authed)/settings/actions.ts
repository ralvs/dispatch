"use server";

import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { ReminderFormSchema, TimezoneFormSchema } from "@/lib/schemas/app-settings";
import { updateAppTimezone, updateReminderSettings } from "@/lib/services/settings";

export async function updateTimezoneAction(formData: FormData): Promise<ActionResult> {
	const { sb } = await requireOwnerPage();
	return runFormAction(formData, async () => {
		const { timezone } = decodeForm(TimezoneFormSchema, formData);
		await updateAppTimezone(sb, timezone);
		// Every page derives its day boundary from this one value.
		afterMutation("settings.timezone");
	});
}

export async function updateReminderSettingsAction(formData: FormData): Promise<ActionResult> {
	const { sb } = await requireOwnerPage();
	return runFormAction(formData, async () => {
		const parsed = decodeForm(ReminderFormSchema, formData);
		await updateReminderSettings(sb, {
			offsetMinutes: parsed.reminder_offset_minutes,
			anchorTime: parsed.reminder_anchor_time,
		});
		afterMutation("settings.reminders");
	});
}
