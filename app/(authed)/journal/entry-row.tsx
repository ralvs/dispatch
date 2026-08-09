"use client";

import { useTransition } from "react";
import { Button, ListRow, rowTitle } from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import type { JournalEntryRow } from "@/lib/services/journal";
import { deleteEntryAction } from "./actions";

export function EntryRowItem({ entry }: { entry: JournalEntryRow }) {
	const [pending, startTransition] = useTransition();

	return (
		<ListRow
			align="start"
			className={pending ? "opacity-50" : ""}
			trailing={
				<Button
					type="button"
					variant="danger"
					size="sm"
					aria-label={`Delete journal entry from ${entry.entry_date}`}
					disabled={pending}
					onClick={() =>
						startTransition(async () => {
							await runAction(async () => deleteEntryAction(entry.id), "Couldn't delete entry.");
						})
					}
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
