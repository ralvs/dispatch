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
			<header className="hairline-strong pb-4">
				<p className="label">Journal</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Pages worth keeping</h1>
			</header>

			<section className="mt-6">
				<JournalForm todayIso={todayInTz(tz)} />
			</section>

			<section className="mt-6" aria-label="Journal entries">
				{entries.length === 0 ? (
					<p className="py-8 text-center font-serif italic text-ink-3">
						Nothing written yet. Capture what happened today.
					</p>
				) : (
					[...groups.entries()].map(([date, dayEntries]) => (
						<div key={date} className="mt-6 first:mt-2">
							<p className="text-meta text-ink-4">{formatDay(date, tz)}</p>
							<ul className="list-card mt-3">
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
