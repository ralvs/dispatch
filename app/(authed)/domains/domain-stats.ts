import type { Stat } from "@/components/ui";
import type { DomainTouch } from "@/lib/services/observations";

/**
 * The band the shape plan §05 asked for: within cadence, gone quiet, and the
 * longest quiet run. Fed by the same last-touch computation the neglect cron
 * runs (§04) — the page and the cron cannot disagree about what "quiet" means
 * because they call the same function.
 *
 * Only domains that actually have a cadence rule are measured. A domain with
 * no rule is not "within cadence"; it opted out, and counting it either way
 * would make the band lie.
 */
export function domainStats(touches: DomainTouch[]): Stat[] {
	const ruled = touches.filter((t) => t.thresholdDays !== null);
	const quiet = ruled.filter((t) => t.quiet);
	const longest = quiet.reduce<number | null>(
		(acc, t) =>
			t.daysSinceTouch !== null && (acc === null || t.daysSinceTouch > acc)
				? t.daysSinceTouch
				: acc,
		null,
	);

	return [
		{ value: ruled.length - quiet.length, label: "within cadence" },
		{ value: quiet.length, label: "gone quiet", attention: quiet.length > 0 },
		{ value: longest === null ? "—" : `${longest}d`, label: "longest quiet run" },
	];
}
