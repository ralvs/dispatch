"use client";

import { useTransition } from "react";
import { Button, Field, Select } from "@/components/ui";
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
			className="mt-2 flex flex-wrap items-end gap-3"
		>
			<Field label="Timezone" className="min-w-0 sm:min-w-56">
				<Select name="timezone" defaultValue={current} disabled={pending}>
					{zones.map((zone) => (
						<option key={zone} value={zone}>
							{zone}
						</option>
					))}
				</Select>
			</Field>
			<Button type="submit" variant="tertiary" size="sm" isPending={pending} disabled={pending}>
				{pending ? "Saving…" : "Save"}
			</Button>
			<p className="w-full font-mono text-meta text-ink-4">
				Day boundaries, due dates, and every "today" in the app follow this zone.
			</p>
		</form>
	);
}
