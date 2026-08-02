import type { RoutineBucketRow } from "@/lib/services/today";

export function RoutineCheckRow({
	row,
	onToggle,
}: {
	row: RoutineBucketRow;
	onToggle: () => void;
}) {
	return (
		<li className="flex items-baseline gap-3 border-b border-line py-2">
			{/* The visible box stays 16×16; a padded wrapper grows the actual hit area to 44px. */}
			<span className="-m-3.5 inline-flex shrink-0 items-center justify-center self-center p-3.5">
				<input
					type="checkbox"
					checked={row.done}
					aria-label={row.done ? `Undo "${row.name}"` : `Complete "${row.name}"`}
					onChange={onToggle}
					className={`h-4 w-4 shrink-0 appearance-none border active:opacity-70 ${
						row.done ? "border-ink-4 bg-ink-4" : "border-line-strong hover:border-ink-3"
					}`}
				/>
			</span>
			<span
				className={`min-w-0 flex-1 text-sm ${row.done ? "text-ink-4 line-through" : "text-ink"}`}
			>
				{row.name}
			</span>
			{row.specificTime && (
				<span className="font-mono text-meta tabular-nums text-ink-4">
					{row.specificTime.slice(0, 5)}
					{row.reminderEnabled ? <span aria-hidden="true"> 🔔</span> : ""}
				</span>
			)}
			{row.streak > 1 && (
				<span className="font-mono text-meta text-ink-3" title={`${row.streak}-day streak`}>
					<span aria-hidden="true">🔥</span> {row.streak}
				</span>
			)}
			{row.missed && !row.done && (
				<span
					className="font-mono text-meta text-accent-slip"
					title="Past its time and still unchecked"
				>
					<span aria-hidden="true">⚠</span> missed
				</span>
			)}
		</li>
	);
}
