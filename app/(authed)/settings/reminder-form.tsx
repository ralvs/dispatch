"use client";

import { useTransition } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import { formatReminderOffset, REMINDER_CHOICES } from "@/lib/reminders";
import { updateReminderSettingsAction } from "./actions";

export function ReminderForm({
	offsetMinutes,
	anchorTime,
}: {
	offsetMinutes: number;
	anchorTime: string;
}) {
	const [pending, startTransition] = useTransition();

	return (
		<form
			action={(formData) =>
				startTransition(async () => {
					await runAction(
						() => updateReminderSettingsAction(formData),
						"Couldn't update reminder settings.",
					);
				})
			}
			className="mt-2 flex flex-wrap items-end gap-3"
		>
			<Field label="Remind me">
				<Select
					name="reminder_offset_minutes"
					defaultValue={String(offsetMinutes)}
					disabled={pending}
				>
					{REMINDER_CHOICES.map((minutes) => (
						<option key={minutes} value={minutes}>
							{formatReminderOffset(minutes)}
						</option>
					))}
				</Select>
			</Field>
			<Field label="Anchor time">
				<Input
					type="time"
					name="reminder_anchor_time"
					defaultValue={anchorTime.slice(0, 5)}
					disabled={pending}
				/>
			</Field>
			<Button type="submit" variant="tertiary" size="sm" isPending={pending} disabled={pending}>
				{pending ? "Saving…" : "Save"}
			</Button>
			<p className="w-full text-meta text-ink-4">
				Measured from a task's due time. The anchor time is used when a task has a due date but no
				due time. A task with no due date never fires a reminder. Reminders are global — there is no
				per-task override.
			</p>
		</form>
	);
}
