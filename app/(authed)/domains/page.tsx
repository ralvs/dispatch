import { ListSection, PageHeader, StatBand } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomains, getCachedDomainTouches } from "@/lib/cache/domains";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { cadenceThresholdDays } from "@/lib/services/domains";
import { DomainCreateButton } from "./domain-form";
import { DomainRowItem } from "./domain-row";
import { domainStats } from "./domain-stats";

export default async function DomainsPage() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const tz = await getCachedAppTimezone();
	const [domains, touches] = await Promise.all([
		getCachedDomains(true),
		getCachedDomainTouches(todayInTz(tz), tz),
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
