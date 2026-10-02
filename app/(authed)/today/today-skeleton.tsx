import type { ReactNode } from "react";
import {
	Bone,
	Card,
	CheckboxBone,
	ragged,
	repeat,
	SkeletonStatus,
	TextBone,
} from "@/components/ui";

/*
 * Today's silhouette while the fan-out is in flight: the day nav, the hero
 * with the counters beside it, the tape, then the two columns — Timeline and
 * Open on the left, the Top 3, Routines and Projects cards on the right.
 *
 * It is built from utilities alone. TodayStyles (the `t-cols` stack) only
 * mounts with the real body, so the skeleton spells the same geometry out:
 * a 1.5fr / 1fr grid at `lg`, and below it one column where the column
 * wrappers dissolve and `order` lifts Top 3 and Routines above the lists —
 * the phone order day-view.tsx uses.
 */

function SectionHeadBone({ width }: { width: string }) {
	return (
		<div className="mb-1.5 flex items-baseline gap-2">
			<TextBone className="type-section" width={width} />
		</div>
	);
}

/** A DayRow: optional time, checkbox, title, the due meta on the right. */
function DayRowBone({ i, time = false }: { i: number; time?: boolean }) {
	return (
		<li className="flex min-h-12 items-center gap-3 border-b border-line py-3 last:border-b-0">
			{time ? <TextBone className="w-11 font-mono text-meta" width="w-9" /> : <CheckboxBone />}
			<TextBone className="flex-1 text-base leading-[1.35]" width={ragged(i)} />
			<TextBone className="font-mono text-meta" width="w-16" />
		</li>
	);
}

function CardBone({ children, className }: { children: ReactNode; className: string }) {
	return (
		<section className={className}>
			<Card padding="none" className="px-6 py-5 lg:py-[22px]">
				{children}
			</Card>
		</section>
	);
}

export function TodaySkeleton({ dateline }: { dateline?: string }) {
	return (
		<div>
			<SkeletonStatus />
			{/* DayNav: the two step circles around the dateline. The dateline is
			    printed for real when the caller knows it — it is not data. */}
			<div className="mb-6 flex items-center gap-1.5 py-3 lg:mb-4 lg:gap-2 lg:p-0">
				<Bone className="size-7 rounded-pill" />
				{dateline ? (
					<p className="px-3 font-mono text-eyebrow uppercase tracking-widest text-ink-3">
						{dateline}
					</p>
				) : (
					<TextBone className="px-3 font-mono text-eyebrow" width="w-44" />
				)}
				<Bone className="size-7 rounded-pill" />
			</div>

			<div>
				<div className="lg:flex lg:items-end lg:justify-between lg:gap-12">
					{/* The page keeps its h1 while DayHeadline is in flight. */}
					<h1 className="m-0 max-w-[16ch] text-t36 lg:text-hero">
						<span className="sr-only">Today</span>
						<TextBone width="w-[7ch]" />
					</h1>
					{/* Counters: a wrapped row on a phone, a right-aligned stack on desk. */}
					<div
						aria-hidden="true"
						className="mt-5 flex flex-wrap gap-x-[18px] gap-y-1.5 lg:mt-0 lg:grid lg:shrink-0 lg:justify-items-end lg:gap-[7px] lg:pb-1.5"
					>
						{["w-16", "w-14", "w-24", "w-24", "w-24"].map((w, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder.
							<TextBone key={i} className="text-base" width={w} />
						))}
					</div>
				</div>

				{/* DayTape: the start-time row (desk only), the track, the ruler. */}
				<div aria-hidden="true" className="mt-10">
					<div className="mb-[5px] hidden h-4 lg:block" />
					<Bone className="h-10 rounded-[11px] lg:h-[46px] lg:rounded-[12px]" />
					<div className="mt-2 flex h-[15px] justify-between lg:mt-[9px] lg:h-4">
						{repeat(7, (i) => (
							// The wrapper owns display: Bone is always `block`, and two
							// display utilities on one element resolve by stylesheet order.
							<span key={i} className={i % 3 === 0 ? "block" : "hidden lg:block"}>
								<Bone className="h-2.5 w-9 rounded-sm" />
							</span>
						))}
					</div>
				</div>

				<div
					aria-hidden="true"
					className="mt-9 flex flex-col gap-[34px] lg:mt-13 lg:grid lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-10"
				>
					<div className="contents lg:block lg:min-w-0 lg:space-y-10">
						<section className="order-2 lg:order-none">
							<SectionHeadBone width="w-20" />
							<ul>
								{repeat(2, (i) => (
									<DayRowBone key={i} i={i + 4} time />
								))}
							</ul>
						</section>
						<section className="order-3 lg:order-none">
							<SectionHeadBone width="w-12" />
							<ul>
								{repeat(4, (i) => (
									<DayRowBone key={i} i={i} />
								))}
							</ul>
						</section>
					</div>

					<div className="contents lg:block lg:min-w-0 lg:space-y-4">
						<CardBone className="order-1 lg:order-none">
							<SectionHeadBone width="w-24" />
							<ul>
								{repeat(3, (i) => (
									<li
										key={i}
										className="flex min-h-12 items-center gap-3 border-b border-line py-3 last:border-b-0"
									>
										<TextBone className="font-mono text-meta" width="w-4" />
										<CheckboxBone />
										<TextBone className="flex-1 text-base leading-[1.35]" width={ragged(i + 1)} />
									</li>
								))}
							</ul>
						</CardBone>
						<CardBone className="order-4 lg:order-none">
							<div className="flex items-center justify-between gap-4">
								<div className="min-w-0">
									<TextBone className="type-section" width="w-20" />
									<TextBone className="mt-1 font-mono text-meta" width="w-48" />
								</div>
								<Bone className="size-12 rounded-full lg:size-13" />
							</div>
							<ul className="mt-3.5">
								{repeat(3, (i) => (
									<li key={i} className="flex min-h-[46px] items-center gap-3 py-2">
										<Bone className="size-[17px] rounded-[5px]" />
										<TextBone className="flex-1 text-base" width={ragged(i + 3)} />
										<Bone className="h-1.5 w-[60px] rounded-sm" />
									</li>
								))}
							</ul>
						</CardBone>
					</div>
				</div>
			</div>
		</div>
	);
}
