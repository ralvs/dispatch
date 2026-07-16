"use client";

import { useTransition } from "react";
import type { JournalEntryRow } from "@/lib/services/journal";
import { deleteEntryAction } from "./actions";

export function EntryRowItem({ entry }: { entry: JournalEntryRow }) {
	const [pending, startTransition] = useTransition();

	return (
		<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`}>
			<p className="whitespace-pre-wrap font-serif text-base text-ink">
				{entry.transcription_text}
			</p>
			<div className="mt-2 flex items-center justify-between">
				<p className="font-mono text-meta text-ink-4">
					{entry.tags.length > 0 ? entry.tags.join(", ") : "—"}
				</p>
				<button
					type="button"
					aria-label={`Delete journal entry from ${entry.entry_date}`}
					disabled={pending}
					onClick={() => startTransition(() => deleteEntryAction(entry.id))}
					className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
				>
					Delete
				</button>
			</div>
		</li>
	);
}
