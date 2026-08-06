import { Checkbox } from "@/components/ui";
import type { RoutineBucketRow } from "@/lib/services/today";

export function RoutineCheckRow({
	row,
	onToggle,
}: {
	row: RoutineBucketRow;
	onToggle: () => void;
}) {
	return (
		<li className="flex items-center gap-3 hairline py-3">
			<Checkbox
				checked={row.done}
				aria-label={row.done ? `Undo "${row.name}"` : `Complete "${row.name}"`}
				onChange={onToggle}
				className="min-w-0 flex-1"
			>
				<span className={row.done ? "text-ink-4 line-through" : undefined}>{row.name}</span>
			</Checkbox>
			{row.specificTime && (
				<span className="shrink-0 font-mono text-meta tabular-nums text-ink-4">
					{row.specificTime.slice(0, 5)}
					{row.reminderEnabled ? <span aria-hidden="true"> 🔔</span> : ""}
				</span>
			)}
			{row.streak > 1 && (
				<span className="shrink-0 text-meta text-ink-3" title={`${row.streak}-day streak`}>
					<span aria-hidden="true">🔥</span> {row.streak}
				</span>
			)}
			{row.missed && !row.done && (
				<span
					className="shrink-0 text-meta text-accent-slip"
					title="Past its time and still unchecked"
				>
					<span aria-hidden="true">⚠</span> missed
				</span>
			)}
		</li>
	);
}
