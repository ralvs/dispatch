import { PushToggle } from "@/components/push-toggle";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { listDomains } from "@/lib/services/domains";
import { getAppTimezone, getReminderSettings } from "@/lib/services/settings";
import { cadenceThresholdDays } from "@/lib/services/today";
import { DomainForm } from "./domain-form";
import { DomainRowItem } from "./domain-row";
import { ReminderForm } from "./reminder-form";
import { TimezoneForm } from "./timezone-form";

export default async function SettingsPage() {
	const { sb } = await requireOwnerPage();
	const [domains, tz, reminderSettings] = await Promise.all([
		listDomains(sb, { includeArchived: true }),
		getAppTimezone(sb),
		getReminderSettings(sb),
	]);
	const active = domains.filter((d) => d.active);
	const archived = domains.filter((d) => !d.active);

	return (
		<div>
			<PageHeader title="Settings" />

			<section aria-label="Domains">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">Domains</h2>
				<p className="mt-1 font-mono text-meta text-ink-4">What I'm stewarding.</p>
				<div className="mt-3">
					<DomainForm />
				</div>
				{active.length === 0 ? (
					<EmptyState>No active domains.</EmptyState>
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
				<div className="mt-2 hairline pb-4">
					<PushToggle />
				</div>
			</section>

			<section className="mt-8" aria-label="App">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">App</h2>
				<TimezoneForm current={tz} />
				<ReminderForm
					offsetMinutes={reminderSettings.offsetMinutes}
					anchorTime={reminderSettings.anchorTime}
				/>
			</section>
		</div>
	);
}
