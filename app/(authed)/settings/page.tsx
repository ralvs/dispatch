import { PushToggle } from "@/components/push-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageHeader, SectionHead } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getAppTimezone, getReminderSettings } from "@/lib/services/settings";
import { ReminderForm } from "./reminder-form";
import { TimezoneForm } from "./timezone-form";

/**
 * Configuration only — knobs that tend to grow, plus account chrome that left
 * the More menu (Pass 4 / C4). Domains are a Library page now.
 */
export default async function SettingsPage() {
	const { sb, claims } = await requireOwnerPage();
	const [tz, reminderSettings] = await Promise.all([getAppTimezone(sb), getReminderSettings(sb)]);

	return (
		<div>
			<PageHeader title="Settings" />

			<section aria-label="Notifications">
				<SectionHead title="Notifications" />
				<div className="hairline pb-4 pt-1">
					<PushToggle />
				</div>
			</section>

			<section className="mt-9" aria-label="App">
				<SectionHead title="App" />
				<TimezoneForm current={tz} />
				<ReminderForm
					offsetMinutes={reminderSettings.offsetMinutes}
					anchorTime={reminderSettings.anchorTime}
				/>
			</section>

			<section className="mt-9" aria-label="Account">
				<SectionHead title="Account" />
				<div className="space-y-3 pt-1">
					<ThemeToggle />
					<p className="truncate text-meta text-ink-4" title={claims.email ?? ""}>
						{claims.email}
					</p>
					<SignOutButton />
				</div>
			</section>
		</div>
	);
}
