"use client";

import { ListSection, PageHeader, StatBand } from "@/components/ui";
import type { DomainItem, DomainTouch } from "@/lib/schemas/domain";
import { useClock, useView, viewKey } from "@/lib/store";
import { DomainCreateButton } from "./domain-form";
import { DomainRowItem } from "./domain-row";
import { domainStats } from "./domain-stats";

const NO_DOMAINS: DomainItem[] = [];

/**
 * /domains from the entity store (#30). The measure, the band and both
 * sections read the same rows, so archiving a domain moves it to Archived and
 * out of the band at once, with no page render.
 */
export function DomainList() {
	const domains = useView(viewKey.domains()) ?? NO_DOMAINS;
	const { tz } = useClock();
	const active = domains.filter((d) => d.active);
	const archived = domains.filter((d) => !d.active);
	// The sweep measures active domains only (lib/services/observations.ts).
	const touches = active.flatMap((d): DomainTouch[] => (d.touch ? [d.touch] : []));

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
								<DomainRowItem key={d.id} domain={d} tz={tz} />
							))}
						</ul>
					) : undefined}
				</ListSection>

				{archived.length > 0 && (
					<ListSection title="Archived" count={archived.length}>
						<ul>
							{archived.map((d) => (
								<DomainRowItem key={d.id} domain={d} tz={tz} />
							))}
						</ul>
					</ListSection>
				)}
			</div>
		</div>
	);
}
