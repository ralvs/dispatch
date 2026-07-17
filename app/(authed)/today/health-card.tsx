import Link from "next/link";
import { formatInstant } from "@/lib/dates";
import type { HealthGlance } from "@/lib/services/briefing";

export function HealthCard({ health, tz }: { health: HealthGlance; tz: string }) {
	const { latestMetric, activeMedsCount, lastWorkout, lastCheckIn } = health;
	if (!latestMetric && activeMedsCount === 0 && !lastWorkout && !lastCheckIn) return null;

	return (
		<section className="mt-8" aria-label="Health at a glance">
			<div className="flex items-baseline justify-between">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Health</h2>
				<Link href="/health" className="font-mono text-meta text-ink-4 hover:text-ink-2">
					All →
				</Link>
			</div>
			<ul className="mt-2">
				{latestMetric && (
					<li className="flex items-baseline justify-between gap-3 border-b border-line py-2">
						<span className="text-sm text-ink">
							{latestMetric.metric}
							{latestMetric.value !== null && (
								<span className="tabular-nums">
									{" "}
									{latestMetric.value}
									{latestMetric.value_secondary !== null ? `/${latestMetric.value_secondary}` : ""}
									{latestMetric.unit ? ` ${latestMetric.unit}` : ""}
								</span>
							)}
						</span>
						<span className="font-mono text-meta text-ink-4">
							{formatInstant(latestMetric.measured_at, tz, "d LLL")}
						</span>
					</li>
				)}
				{lastWorkout && (
					<li className="flex items-baseline justify-between gap-3 border-b border-line py-2">
						<span className="text-sm text-ink">
							{lastWorkout.activity_type ?? "Workout"}
							{lastWorkout.duration_min !== null && (
								<span className="tabular-nums"> · {lastWorkout.duration_min} min</span>
							)}
						</span>
						<span className="font-mono text-meta text-ink-4">
							{formatInstant(lastWorkout.started_at, tz, "d LLL")}
						</span>
					</li>
				)}
				{lastCheckIn && (
					<li className="flex items-baseline justify-between gap-3 border-b border-line py-2">
						<span className="text-sm text-ink">
							Check-in
							{lastCheckIn.mood !== null && (
								<span className="tabular-nums"> · mood {lastCheckIn.mood}</span>
							)}
							{lastCheckIn.energy !== null && (
								<span className="tabular-nums"> · energy {lastCheckIn.energy}</span>
							)}
						</span>
						<span className="font-mono text-meta text-ink-4">
							{formatInstant(lastCheckIn.checked_in_at, tz, "d LLL")}
						</span>
					</li>
				)}
				{activeMedsCount > 0 && (
					<li className="border-b border-line py-2 text-sm text-ink">
						<span className="tabular-nums">{activeMedsCount}</span> active medication
						{activeMedsCount === 1 ? "" : "s"}
					</li>
				)}
			</ul>
		</section>
	);
}
