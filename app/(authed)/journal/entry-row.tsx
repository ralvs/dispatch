"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import type { JournalEntryRow } from "@/lib/services/journal";
import { deleteEntryAction } from "./actions";

export function EntryRowItem({ entry }: { entry: JournalEntryRow }) {
	const [pending, startTransition] = useTransition();

	return (
		<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`}>
			<p className="max-w-prose whitespace-pre-wrap break-words font-serif text-base text-ink">
				{entry.transcription_text}
			</p>
			<div className="mt-2 flex items-center justify-between">
				<p className="text-meta text-ink-4">
					{entry.tags.length > 0 ? entry.tags.join(", ") : "—"}
				</p>
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
			</div>
		</li>
	);
}
