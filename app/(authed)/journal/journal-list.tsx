"use client";

import { EmptyState, ListSection, PageHeader } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import type { JournalEntryRow } from "@/lib/schemas/journal";
import { useClock, useView, viewKey } from "@/lib/store";
import { EntryRowItem } from "./entry-row";
import { JournalForm } from "./journal-form";

const NO_ENTRIES: JournalEntryRow[] = [];

/**
 * /journal from the entity store (#30). The count, the day groups and the rows
 * read the same entries, so a new entry lands under its day at once, with no
 * page render.
 */
export function JournalList() {
	const entries = useView(viewKey.journal()) ?? NO_ENTRIES;
	const { todayIso, tz } = useClock();

	const groups = new Map<string, JournalEntryRow[]>();
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
				<JournalForm todayIso={todayIso} />
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
