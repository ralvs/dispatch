"use client";

import { Button, ListRow, rowTitle } from "@/components/ui";
import type { JournalEntryRow } from "@/lib/services/journal";
import { useProvisionalIds, useWrites } from "@/lib/store";
import { journalWrites } from "./writes";

export function EntryRowItem({ entry }: { entry: JournalEntryRow }) {
	// The entry leaves the list at once; a failure puts it back (#30).
	const { send } = useWrites();
	// Still being saved: its id is the client's, so nothing may act on it yet.
	const saving = useProvisionalIds("journal").has(entry.id);

	return (
		<ListRow
			align="start"
			trailing={
				<Button
					type="button"
					variant="danger"
					size="sm"
					aria-label={`Delete journal entry from ${entry.entry_date}`}
					disabled={saving}
					onClick={() => send(journalWrites.remove(entry.id))}
				>
					Delete
				</Button>
			}
		>
			<p
				className={rowTitle({
					layout: "bare",
					className: "measure-prose whitespace-pre-wrap break-words",
				})}
			>
				{entry.transcription_text}
			</p>
			{entry.tags.length > 0 && (
				<p className="mt-1 font-mono text-meta text-ink-4">{entry.tags.join(", ")}</p>
			)}
		</ListRow>
	);
}
