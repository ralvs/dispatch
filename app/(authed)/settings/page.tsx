import { Suspense } from "react";
import { PushToggle } from "@/components/push-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PageHeader, SectionHead, SkeletonRows } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedAppTimezone, getCachedReminderSettings } from "@/lib/cache/settings";
import { ReminderForm } from "./reminder-form";
import { TimezoneForm } from "./timezone-form";

async function AppSettings() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [tz, reminderSettings] = await Promise.all([
		getCachedAppTimezone(),
		getCachedReminderSettings(),
	]);

	return (
		<>
			<TimezoneForm current={tz} />
			<ReminderForm
				offsetMinutes={reminderSettings.offsetMinutes}
				anchorTime={reminderSettings.anchorTime}
			/>
		</>
	);
}

async function AccountEmail() {
	const { claims } = await requireOwnerPage();
	return (
		<p className="truncate text-meta text-ink-4" title={claims.email ?? ""}>
			{claims.email}
		</p>
	);
}

/**
 * Configuration only — knobs that tend to grow, plus account chrome that left
 * the More menu (Pass 4 / C4). Domains are a Library page now.
 *
 * The page itself is static: the toggles and sign-out read nothing on the
 * server, so they come out of the prerendered shell. Only the two stored
 * settings and the signed-in email stream in.
 */
export default function SettingsPage() {
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
				<Suspense fallback={<SkeletonRows rows={4} />}>
					<AppSettings />
				</Suspense>
			</section>

			<section className="mt-9" aria-label="Account">
				<SectionHead title="Account" />
				<div className="space-y-3 pt-1">
					<ThemeToggle />
					<Suspense
						fallback={
							<div className="h-4 w-48 animate-pulse rounded bg-surface" aria-hidden="true" />
						}
					>
						<AccountEmail />
					</Suspense>
					<SignOutButton />
				</div>
			</section>
		</div>
	);
}
