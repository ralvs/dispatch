import { Suspense } from "react";
import { MoreBackLink, PageHeader, SectionHead } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedAppTimezone, getCachedReminderSettings } from "@/lib/cache/settings";
import { PushToggle } from "./push-toggle";
import { ReminderForm } from "./reminder-form";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";
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

/* Two SettingsForm blocks: a labelled field with Save, and the note under it. */
function AppSettingsFallback() {
	return (
		<>
			<span role="status" className="sr-only">
				Loading
			</span>
			{[0, 1].map((i) => (
				<div key={i} className="mt-2 space-y-2" aria-hidden="true">
					<div className="h-3 w-20 animate-pulse rounded bg-surface" />
					<div className="h-9 w-full animate-pulse rounded bg-surface sm:w-56" />
					<div className="h-3 w-3/4 animate-pulse rounded bg-surface" />
				</div>
			))}
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
			<MoreBackLink />
			<PageHeader title="Settings" />

			<section aria-label="Notifications">
				<SectionHead title="Notifications" />
				<div className="hairline pb-4 pt-1">
					<PushToggle />
				</div>
			</section>

			<section className="mt-9" aria-label="App">
				<SectionHead title="App" />
				<Suspense fallback={<AppSettingsFallback />}>
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
