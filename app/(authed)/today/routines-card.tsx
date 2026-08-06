"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { runAction } from "@/lib/client/toast";
import type { RoutineBucket, RoutineBucketRow } from "@/lib/services/today";
import { toggleCompletionAction } from "../routines/actions";
import { RoutineCheckRow } from "./routine-check-row";

const BUCKET_LABELS: Record<RoutineBucket["bucket"], string> = {
	morning: "Morning",
	afternoon: "Afternoon",
	evening: "Evening",
	anytime: "Anytime",
};

/**
 * Owns useOptimistic for routine checkboxes so they flip before the Today
 * RSC round-trip — same pattern as DaySchedule task toggles.
 */
export function RoutinesCard({
	buckets,
	done,
	total,
}: {
	buckets: RoutineBucket[];
	done: number;
	total: number;
}) {
	const [, startTransition] = useTransition();
	const [optBuckets, dispatchOptimistic] = useOptimistic(
		buckets,
		(current, intent: { id: string; done: boolean }) =>
			current.map((bucket) => ({
				...bucket,
				rows: bucket.rows.map((row) =>
					row.id === intent.id ? { ...row, done: intent.done } : row,
				),
			})),
	);

	if (total === 0) return null;

	const optDone = optBuckets.reduce((n, bucket) => n + bucket.rows.filter((r) => r.done).length, 0);
	// Prefer live optimistic count; fall back to server seed if buckets empty mid-flight.
	const displayDone = optBuckets.length > 0 ? optDone : done;

	function toggle(row: RoutineBucketRow) {
		const currentlyDone = row.done;
		startTransition(async () => {
			dispatchOptimistic({ id: row.id, done: !currentlyDone });
			await runAction(
				() => toggleCompletionAction(row.id, currentlyDone),
				"Couldn't update routine.",
			);
		});
	}

	return (
		<section className="mt-8" aria-label="Routines today">
			<div className="flex items-baseline justify-between">
				<h2 className="label">
					Routines · {displayDone} of {total} today
				</h2>
				<Link href="/routines" className="text-meta text-ink-4 hover:text-ink-2">
					All →
				</Link>
			</div>
			{optBuckets.map((bucket) => (
				<div key={bucket.bucket} className="mt-3">
					<h3 className="label text-ink-4">{BUCKET_LABELS[bucket.bucket]}</h3>
					<ul className="list-card mt-3">
						{bucket.rows.map((row) => (
							<RoutineCheckRow key={row.id} row={row} onToggle={() => toggle(row)} />
						))}
					</ul>
				</div>
			))}
		</section>
	);
}
