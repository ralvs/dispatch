"use client";

import { useTransition } from "react";
import { assignDomainAction } from "@/app/(authed)/tasks/actions";
import { ColorDot } from "@/components/color-dot";
import { runAction } from "@/lib/client/toast";
import type { TaskRow } from "@/lib/services/tasks";

type DomainOption = { id: string; name: string; color: string | null };

export function InboxRow({ task, domains }: { task: TaskRow; domains: DomainOption[] }) {
	const [pending, startTransition] = useTransition();
	// Every domain is a valid destination now — the inbox is the absence of one,
	// so there is nothing to filter out. Filing stays one-way because no write
	// path sets domain_id back to null (docs/adr/0025).

	return (
		<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`}>
			<p className="text-sm text-ink">{task.title}</p>
			<div className="mt-2 flex flex-wrap gap-1.5">
				{domains.map((d) => (
					<button
						key={d.id}
						type="button"
						disabled={pending}
						// Without this the accessible name is the bare domain name, which
						// reads as an unattached list of words to a screen reader.
						aria-label={`Move ${task.title} to ${d.name}`}
						onClick={() =>
							startTransition(async () => {
								await runAction(() => assignDomainAction(task.id, d.id), "Couldn't file task.");
							})
						}
						className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
					>
						<ColorDot color={d.color} />
						{d.name}
					</button>
				))}
			</div>
		</li>
	);
}
