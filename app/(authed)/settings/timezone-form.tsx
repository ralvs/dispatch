"use client";

import { Field, Select } from "@/components/ui";
import { updateTimezoneAction } from "./actions";
import { SettingsForm } from "./settings-form";

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
	const zones = COMMON_ZONES.includes(current) ? COMMON_ZONES : [current, ...COMMON_ZONES];

	return (
		<SettingsForm
			action={updateTimezoneAction}
			errorMessage="Couldn't update timezone."
			note='Day boundaries, due dates, and every "today" in the app follow this zone.'
		>
			<Field label="Timezone" name="timezone" className="min-w-0 sm:min-w-56">
				<Select name="timezone" defaultValue={current}>
					{zones.map((zone) => (
						<option key={zone} value={zone}>
							{zone}
						</option>
					))}
				</Select>
			</Field>
		</SettingsForm>
	);
}
