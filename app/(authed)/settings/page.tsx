import { PushToggle } from "@/components/push-toggle";
import { requireOwnerPage } from "@/lib/auth";
import { isGoogleOAuthConfigured } from "@/lib/env";
import { cadenceThresholdDays } from "@/lib/services/briefing";
import { listDomains } from "@/lib/services/domains";
import { getGoogleConnectionStatus } from "@/lib/services/google-auth";
import { getAppTimezone } from "@/lib/services/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { DomainForm } from "./domain-form";
import { DomainRowItem } from "./domain-row";
import { GoogleCalendarCard } from "./google-calendar-card";
import { TimezoneForm } from "./timezone-form";

export default async function SettingsPage({
	searchParams,
}: {
	searchParams: Promise<{ gcal?: string; reason?: string }>;
}) {
	const { sb } = await requireOwnerPage();
	const params = await searchParams;
	const [domains, tz, gcal] = await Promise.all([
		listDomains(sb, { includeArchived: true }),
		getAppTimezone(sb),
		// Token row is service-role only — admin after requireOwner is fine.
		getGoogleConnectionStatus(createAdminClient()),
	]);
	const active = domains.filter((d) => d.active);
	const archived = domains.filter((d) => !d.active);

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Settings</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">The back office</h1>
			</header>

			<section className="mt-6" aria-label="Domains">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">Domains</h2>
				<p className="mt-1 font-mono text-meta text-ink-4">What I'm stewarding.</p>
				<div className="mt-3">
					<DomainForm />
				</div>
				{active.length === 0 ? (
					<p className="py-6 text-center font-serif italic text-ink-3">No active domains.</p>
				) : (
					<ul className="mt-2">
						{active.map((d) => (
							<DomainRowItem
								key={d.id}
								domain={d}
								tz={tz}
								cadenceDays={cadenceThresholdDays(d.failure_patterns)}
							/>
						))}
					</ul>
				)}
			</section>

			{archived.length > 0 && (
				<section className="mt-8" aria-label="Archived domains">
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
						Archived domains
					</h2>
					<ul className="mt-2">
						{archived.map((d) => (
							<DomainRowItem
								key={d.id}
								domain={d}
								tz={tz}
								cadenceDays={cadenceThresholdDays(d.failure_patterns)}
							/>
						))}
					</ul>
				</section>
			)}

			<section className="mt-8" aria-label="Notifications">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
					Notifications
				</h2>
				<div className="mt-2 border-b border-line pb-4">
					<PushToggle />
				</div>
			</section>

			<section className="mt-8" aria-label="Integrations">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
					Integrations
				</h2>
				<GoogleCalendarCard
					oauthConfigured={isGoogleOAuthConfigured()}
					connected={gcal.connected}
					accountEmail={gcal.accountEmail}
					lastSyncedAt={gcal.lastSyncedAt}
					statusQuery={params.gcal ?? null}
					statusReason={params.reason ?? null}
				/>
			</section>

			<section className="mt-8" aria-label="App">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">App</h2>
				<TimezoneForm current={tz} />
			</section>
		</div>
	);
}
