"use client";

import { useTransition } from "react";
import { runAction } from "@/lib/client/toast";
import type { RoutineBucketRow } from "@/lib/services/briefing";
import { toggleCompletionAction } from "../routines/actions";

export function RoutineCheckRow({ row }: { row: RoutineBucketRow }) {
	const [pending, startTransition] = useTransition();

	return (
		<li
			className={`flex items-baseline gap-3 border-b border-line py-2 ${
				pending ? "opacity-50" : ""
			}`}
		>
			<input
				type="checkbox"
				checked={row.done}
				aria-label={row.done ? `Undo "${row.name}"` : `Complete "${row.name}"`}
				disabled={pending}
				onChange={() =>
					startTransition(async () => {
						await runAction(
							() => toggleCompletionAction(row.id, row.done),
							"Couldn't update routine.",
						);
					})
				}
				className={`h-4 w-4 shrink-0 appearance-none self-center border ${
					row.done ? "border-ink-4 bg-ink-4" : "border-line-strong hover:border-ink-3"
				}`}
			/>
			<span
				className={`min-w-0 flex-1 text-sm ${row.done ? "text-ink-4 line-through" : "text-ink"}`}
			>
				{row.name}
			</span>
			{row.specificTime && (
				<span className="font-mono text-meta tabular-nums text-ink-4">
					{row.specificTime.slice(0, 5)}
					{row.reminderEnabled ? " 🔔" : ""}
				</span>
			)}
			{row.streak > 1 && (
				<span className="font-mono text-meta text-ink-3" title={`${row.streak}-day streak`}>
					🔥 {row.streak}
				</span>
			)}
		</li>
	);
}
