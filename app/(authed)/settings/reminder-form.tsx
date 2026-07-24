"use client";

import { useTransition } from "react";
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
			className="mt-2 flex flex-wrap items-center gap-2"
		>
			<label className="flex items-center gap-2">
				<span className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					Remind me
				</span>
				<select
					name="reminder_offset_minutes"
					defaultValue={offsetMinutes}
					disabled={pending}
					className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink disabled:opacity-50"
				>
					{REMINDER_CHOICES.map((minutes) => (
						<option key={minutes} value={minutes}>
							{formatReminderOffset(minutes)}
						</option>
					))}
				</select>
			</label>
			<label className="flex items-center gap-2">
				<span className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					Anchor time
				</span>
				<input
					type="time"
					name="reminder_anchor_time"
					defaultValue={anchorTime.slice(0, 5)}
					disabled={pending}
					className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink disabled:opacity-50"
				/>
			</label>
			<button
				type="submit"
				disabled={pending}
				className="rounded-md border border-line px-2 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink disabled:opacity-50"
			>
				{pending ? "Saving…" : "Save"}
			</button>
			<p className="w-full font-mono text-meta text-ink-4">
				Measured from a task's due time. The anchor time is used when a task has a due date but no
				due time. A task with no due date never fires a reminder. Reminders are global — there is no
				per-task override.
			</p>
		</form>
	);
}
