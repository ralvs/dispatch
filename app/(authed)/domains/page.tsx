import { ListSection, PageHeader, StatBand } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { listDomains } from "@/lib/services/domains";
import { listDomainTouches } from "@/lib/services/observations";
import { getAppTimezone } from "@/lib/services/settings";
import { cadenceThresholdDays } from "@/lib/services/today";
import { DomainCreateButton } from "./domain-form";
import { DomainRowItem } from "./domain-row";
import { domainStats } from "./domain-stats";

export default async function DomainsPage() {
	const { sb } = await requireOwnerPage();
	const [domains, tz, touches] = await Promise.all([
		listDomains(sb, { includeArchived: true }),
		getAppTimezone(sb),
		listDomainTouches(sb),
	]);
	const active = domains.filter((d) => d.active);
	const archived = domains.filter((d) => !d.active);
	const touchById = new Map(touches.map((t) => [t.domainId, t]));

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

			<StatBand stats={domainStats(touches)} />

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
									touch={touchById.get(d.id) ?? null}
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
									touch={touchById.get(d.id) ?? null}
								/>
							))}
						</ul>
					</ListSection>
				)}
			</div>
		</div>
	);
}
