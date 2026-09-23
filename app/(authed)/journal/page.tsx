import { EmptyState, ListSection, PageHeader } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedJournal } from "@/lib/cache/journal";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { formatDay, todayInTz } from "@/lib/dates";
import { EntryRowItem } from "./entry-row";
import { JournalForm } from "./journal-form";

export default async function JournalPage() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [tz, entries] = await Promise.all([getCachedAppTimezone(), getCachedJournal()]);

	const groups = new Map<string, typeof entries>();
	for (const entry of entries) {
		const group = groups.get(entry.entry_date);
		if (group) group.push(entry);
		else groups.set(entry.entry_date, [entry]);
	}

	return (
		<div>
			<PageHeader
				title="Journal"
				measure={[{ count: entries.length, label: entries.length === 1 ? "entry" : "entries" }]}
			/>

			{/* Standing form stays — writing the entry is the page (ADR-0044). */}
			<section className="measure-prose">
				<JournalForm todayIso={todayInTz(tz)} />
			</section>

			{entries.length === 0 ? (
				<div className="mt-9">
					<EmptyState>Nothing written yet. Capture what happened today.</EmptyState>
				</div>
			) : (
				// Wrapped so date groups are first children of their own stack —
				// first:mt-0 can fire (ADR-0046).
				<div className="mt-9">
					<div>
						{[...groups.entries()].map(([date, dayEntries]) => (
							<ListSection key={date} title={formatDay(date, tz)} count={dayEntries.length}>
								<ul>
									{dayEntries.map((entry) => (
										<EntryRowItem key={entry.id} entry={entry} />
									))}
								</ul>
							</ListSection>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
