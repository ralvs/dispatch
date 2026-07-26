"use client";

import { useTransition } from "react";
import { assignDomainAction } from "@/app/(authed)/tasks/actions";
import { ColorDot } from "@/components/color-dot";
import { runAction } from "@/lib/client/toast";
import type { TaskRow } from "@/lib/services/tasks";

type DomainOption = { id: string; name: string; is_system: boolean; color: string | null };

export function InboxRow({ task, domains }: { task: TaskRow; domains: DomainOption[] }) {
	const [pending, startTransition] = useTransition();
	// The Inbox is never a destination — filing out of it is one-way, enforced
	// in assignDomain (docs/adr/0024). This filter is only the visible half.
	const targets = domains.filter((d) => !d.is_system);

	return (
		<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`}>
			<p className="text-sm text-ink">{task.title}</p>
			<div className="mt-2 flex flex-wrap gap-1.5">
				{targets.map((d) => (
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
