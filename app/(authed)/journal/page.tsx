import { EmptyState, PageHeader } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { formatDay, todayInTz } from "@/lib/dates";
import { listEntries } from "@/lib/services/journal";
import { getAppTimezone } from "@/lib/services/settings";
import { EntryRowItem } from "./entry-row";
import { JournalForm } from "./journal-form";

export default async function JournalPage() {
	const { sb } = await requireOwnerPage();
	const [tz, entries] = await Promise.all([getAppTimezone(sb), listEntries(sb)]);

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

			<section>
				<JournalForm todayIso={todayInTz(tz)} />
			</section>

			<section className="mt-6" aria-label="Journal entries">
				{entries.length === 0 ? (
					<EmptyState>Nothing written yet. Capture what happened today.</EmptyState>
				) : (
					[...groups.entries()].map(([date, dayEntries]) => (
						<div key={date} className="mt-6 first:mt-2">
							<p className="font-mono text-meta uppercase tracking-widest text-ink-4">
								{formatDay(date, tz)}
							</p>
							<ul className="mt-2">
								{dayEntries.map((entry) => (
									<EntryRowItem key={entry.id} entry={entry} />
								))}
							</ul>
						</div>
					))
				)}
			</section>
		</div>
	);
}
