"use client";

import { Field, Input, Select } from "@/components/ui";
import { formatReminderOffset, REMINDER_CHOICES } from "@/lib/reminders";
import { updateReminderSettingsAction } from "./actions";
import { SettingsForm } from "./settings-form";

export function ReminderForm({
	offsetMinutes,
	anchorTime,
}: {
	offsetMinutes: number;
	anchorTime: string;
}) {
	return (
		<SettingsForm
			action={updateReminderSettingsAction}
			errorMessage="Couldn't update reminder settings."
			note="Measured from a task's due time. The anchor time is used when a task has a due date but no due time. A task with no due date never fires a reminder. Reminders are global — there is no per-task override."
		>
			<Field label="Remind me" name="reminder_offset_minutes">
				<Select name="reminder_offset_minutes" defaultValue={String(offsetMinutes)}>
					{REMINDER_CHOICES.map((minutes) => (
						<option key={minutes} value={minutes}>
							{formatReminderOffset(minutes)}
						</option>
					))}
				</Select>
			</Field>
			<Field label="Anchor time" name="reminder_anchor_time">
				<Input type="time" name="reminder_anchor_time" defaultValue={anchorTime.slice(0, 5)} />
			</Field>
		</SettingsForm>
	);
}
