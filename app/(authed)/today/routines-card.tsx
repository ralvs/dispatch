import Link from "next/link";
import type { RoutineBucket } from "@/lib/services/briefing";
import { RoutineCheckRow } from "./routine-check-row";

const BUCKET_LABELS: Record<RoutineBucket["bucket"], string> = {
	morning: "Morning",
	afternoon: "Afternoon",
	evening: "Evening",
	anytime: "Anytime",
};

export function RoutinesCard({
	buckets,
	done,
	total,
}: {
	buckets: RoutineBucket[];
	done: number;
	total: number;
}) {
	if (total === 0) return null;

	return (
		<section className="mt-8" aria-label="Routines today">
			<div className="flex items-baseline justify-between">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					Routines · {done} of {total} today
				</h2>
				<Link href="/routines" className="font-mono text-meta text-ink-4 hover:text-ink-2">
					All →
				</Link>
			</div>
			{buckets.map((bucket) => (
				<div key={bucket.bucket} className="mt-3">
					<h3 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
						{BUCKET_LABELS[bucket.bucket]}
					</h3>
					<ul className="mt-1">
						{bucket.rows.map((row) => (
							<RoutineCheckRow key={row.id} row={row} />
						))}
					</ul>
				</div>
			))}
		</section>
	);
}
