"use client";

import { useTransition } from "react";
import { runAction } from "@/lib/client/toast";
import { updateTimezoneAction } from "./actions";

// A short list beats a 400-entry IANA dropdown for a single-owner app. The
// current value is always an option, so a zone set by hand in SQL survives a
// visit to this form.
const COMMON_ZONES = [
	"America/Sao_Paulo",
	"America/New_York",
	"America/Los_Angeles",
	"Europe/Lisbon",
	"Europe/London",
	"Europe/Berlin",
	"UTC",
];

export function TimezoneForm({ current }: { current: string }) {
	const [pending, startTransition] = useTransition();
	const zones = COMMON_ZONES.includes(current) ? COMMON_ZONES : [current, ...COMMON_ZONES];

	return (
		<form
			action={(formData) =>
				startTransition(async () => {
					await runAction(() => updateTimezoneAction(formData), "Couldn't update timezone.");
				})
			}
			className="mt-2 flex flex-wrap items-center gap-2"
		>
			<label className="flex items-center gap-2">
				<span className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					Timezone
				</span>
				<select
					name="timezone"
					defaultValue={current}
					disabled={pending}
					className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink disabled:opacity-50"
				>
					{zones.map((zone) => (
						<option key={zone} value={zone}>
							{zone}
						</option>
					))}
				</select>
			</label>
			<button
				type="submit"
				disabled={pending}
				className="rounded-md border border-line px-2 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink disabled:opacity-50 active:opacity-70"
			>
				{pending ? "Saving…" : "Save"}
			</button>
			<p className="w-full font-mono text-meta text-ink-4">
				Day boundaries, due dates, and every "today" in the app follow this zone.
			</p>
		</form>
	);
}
