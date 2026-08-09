import { EmptyState, PageHeader, SectionHead } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { listDomains } from "@/lib/services/domains";
import { getAppTimezone } from "@/lib/services/settings";
import { cadenceThresholdDays } from "@/lib/services/today";
import { DomainCreateButton } from "./domain-form";
import { DomainRowItem } from "./domain-row";

export default async function DomainsPage() {
	const { sb } = await requireOwnerPage();
	const [domains, tz] = await Promise.all([
		listDomains(sb, { includeArchived: true }),
		getAppTimezone(sb),
	]);
	const active = domains.filter((d) => d.active);
	const archived = domains.filter((d) => !d.active);

	return (
		<div>
			<PageHeader
				title="Domains"
				measure={[
					{ count: active.length, label: "active" },
					{ count: archived.length, label: "archived" },
				]}
				action={<DomainCreateButton />}
			/>

			<section aria-label="Active domains">
				<SectionHead title="Active" aside={String(active.length)} />
				{active.length === 0 ? (
					<EmptyState>No active domains.</EmptyState>
				) : (
					<ul>
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
					<SectionHead title="Archived" aside={String(archived.length)} />
					<ul>
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
		</div>
	);
}
