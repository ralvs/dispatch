import { ListSection, PageHeader } from "@/components/ui";
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

			<div>
				<ListSection
					title="Active"
					count={active.length}
					empty={active.length === 0 ? "No active domains." : undefined}
				>
					{active.length > 0 ? (
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
					) : undefined}
				</ListSection>

				{archived.length > 0 && (
					<ListSection title="Archived" count={archived.length}>
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
					</ListSection>
				)}
			</div>
		</div>
	);
}
