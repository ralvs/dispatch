"use client";

import { useTransition } from "react";
import { triageTaskAction } from "@/app/(authed)/tasks/actions";
import type { TaskRow } from "@/lib/services/tasks";

type DomainOption = { id: string; name: string; is_system: boolean };

export function TriageRow({ task, domains }: { task: TaskRow; domains: DomainOption[] }) {
	const [pending, startTransition] = useTransition();
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
						onClick={() => startTransition(() => triageTaskAction(task.id, d.id))}
						className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
					>
						{d.name}
					</button>
				))}
			</div>
		</li>
	);
}
