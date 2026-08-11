"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { Card, Checkbox, Progress } from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import type { RoutineBucket, RoutineBucketRow } from "@/lib/services/today";
import { PROGRESS_RENDER } from "@/lib/ui/variant";
import { toggleCompletionAction } from "../routines/actions";

const BUCKET_LABELS: Record<RoutineBucket["bucket"], string> = {
	morning: "Morning",
	afternoon: "Afternoon",
	evening: "Evening",
	anytime: "Anytime",
};

/**
 * Seven days, one square each, oldest first. The streak number beside it is a
 * claim; this is the evidence — and it shows the shape a streak flattens, since
 * a solid six-on-one-off rhythm reads as a streak of 0.
 */
function Trail({ trail }: { trail: boolean[] }) {
	return (
		<span className="flex shrink-0 items-center gap-[3px]" aria-hidden="true">
			{trail.map((done, i) => (
				<i
					// biome-ignore lint/suspicious/noArrayIndexKey: a fixed seven-day window, positional by definition.
					key={i}
					className={`block size-[7px] rounded-[2px] lg:size-1.5 ${done ? "bg-ink-2" : "bg-line-strong"}`}
				/>
			))}
		</span>
	);
}

/** A streak worth noticing takes the accent. Below that it is just a number. */
const HOT_STREAK = 7;

/**
 * Owns useOptimistic for routine checkboxes so they flip before the Today RSC
 * round-trip — same pattern as the day bands' task toggles.
 *
 * The completion figure at the top is the shared `Progress` primitive, so
 * switching the whole page back to A1's bars is one line in lib/ui/variant.ts.
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
	// Which blocks still have something in them — the useful summary, because
	// "3 left" does not tell you when you have to do them.
	const blocksLeft = optBuckets
		.filter((b) => b.rows.some((r) => !r.done))
		.map((b) => BUCKET_LABELS[b.bucket]);

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
		<section className="t-sec-routines" aria-label="Routines today">
			<Card padding="none" className="px-6 py-5 lg:px-6 lg:py-[22px]">
				<div className="flex items-center justify-between gap-4">
					<div className="min-w-0">
						<h2 className="m-0 type-section text-ink">Routines</h2>
						<p className="mt-1 font-mono text-meta text-ink-3">
							{blocksLeft.length === 0
								? "All clear"
								: `${blocksLeft.join(" and ")} block${blocksLeft.length === 1 ? "" : "s"} left`}
						</p>
					</div>
					<Progress
						render={PROGRESS_RENDER}
						value={total === 0 ? 0 : displayDone / total}
						label={`${displayDone} of ${total} routines done today`}
						size={48}
						className="lg:size-13"
					>
						{displayDone}/{total}
					</Progress>
				</div>

				{optBuckets.map((bucket) => (
					<div key={bucket.bucket}>
						<h3 className="mt-3.5 font-mono text-eyebrow uppercase tracking-widest text-ink-3">
							{BUCKET_LABELS[bucket.bucket]}
						</h3>
						<ul>
							{bucket.rows.map((row) => (
								<li key={row.id} className="flex min-h-[46px] items-center gap-3 py-2">
									<Checkbox
										checked={row.done}
										aria-label={row.done ? `Undo "${row.name}"` : `Complete "${row.name}"`}
										onChange={() => toggle(row)}
										className="min-w-0 flex-1"
									>
										<span className={`truncate ${row.done ? "text-ink-4" : ""}`}>{row.name}</span>
									</Checkbox>
									{row.missed && !row.done && (
										<span
											className="shrink-0 font-mono text-meta text-accent"
											title="Past its time and still unchecked"
										>
											missed
										</span>
									)}
									<Trail trail={row.trail} />
									<span
										className={`w-[26px] shrink-0 text-right font-mono text-meta tabular-nums lg:w-[30px] ${
											row.streak >= HOT_STREAK ? "text-accent" : "text-ink-3"
										}`}
										title={`${row.streak}-day streak`}
									>
										{row.streak}
									</span>
								</li>
							))}
						</ul>
					</div>
				))}

				<p className="mt-4">
					<Link href="/routines" className="font-mono text-meta text-ink-3 hover:text-ink-2">
						All routines →
					</Link>
				</p>
			</Card>
		</section>
	);
}
