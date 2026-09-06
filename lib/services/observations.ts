import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listDomains } from "@/lib/services/domains";
import { unwrap } from "@/lib/services/errors";
import { cadenceThresholdDays } from "@/lib/services/today";

// ─── The neglect sweep ─────────────────────────────────────────────────
//
// docs/plan-dispatch-shape-2026-08-21.html §04. The product already promises
// in writing (the "Flag after (days)" help text on /domains) that a cron
// watches for neglect. Until this module there was no such cron: the
// threshold editor wrote a number nothing read, into a table with no rows and
// no writers.
//
// A domain's LAST TOUCH is the max of:
//   1. tasks.completed_at        — work finished in the domain
//   2. projects.updated_at       — project activity in the domain
//   3. notes.created_at          — thinking about the domain (wired by P3;
//                                  plan O3: "attention is what this measure
//                                  is for")
//   4. domains.last_shipped_at   — the manual "I shipped something" stamp
//
// Journal is deliberately NOT a source. The plan lists journal_entries as a
// fifth input, but journal_entries has no domain link and inventing one (tag
// matching against domain names) is a guess the plan never agreed. Recorded
// here rather than silently dropped; adding it is its own small patch.
//
// The sweep writes an `observations` row and a `notifications` row only when
// it actually flags something — a no-op tick is not an action and a ledger of
// "all fine" rows buries the one that matters (the rule
// app/api/cron/sweep/route.ts already follows).

/** The neglect observation's `type`, and the dedupe key alongside domain_id. */
export const NEGLECT_OBSERVATION_TYPE = "domain.neglect";

export type DomainTouch = {
	domainId: string;
	name: string;
	/** UTC ISO of the most recent touch, or null when nothing has ever touched it. */
	lastTouchUtc: string | null;
	/** Whole days since the last touch; null when there has never been one. */
	daysSinceTouch: number | null;
	/** The domain's own "flag after N days" rule; null means never flag. */
	thresholdDays: number | null;
	openTasks: number;
	/** Has a threshold, and is past it (or has never been touched at all). */
	quiet: boolean;
};

/** Whole days between two instants, floored, never negative. */
export function daysBetween(fromUtcIso: string, nowMs: number): number {
	const from = Date.parse(fromUtcIso);
	if (Number.isNaN(from)) return 0;
	return Math.max(0, Math.floor((nowMs - from) / 86_400_000));
}

/** The later of two nullable UTC ISO instants. */
export function laterOf(a: string | null, b: string | null): string | null {
	if (a === null) return b;
	if (b === null) return a;
	return a >= b ? a : b;
}

/**
 * Pure core of the sweep: given a domain's inputs, decide whether it is quiet.
 * Split out from the fetching so the rule is testable without a database.
 */
export function resolveTouch(input: {
	domainId: string;
	name: string;
	failurePatterns: unknown;
	lastShippedAt: string | null;
	lastTaskDoneAt: string | null;
	lastProjectActivityAt: string | null;
	lastNoteAt: string | null;
	openTasks: number;
	nowMs: number;
}): DomainTouch {
	const lastTouchUtc = [
		input.lastShippedAt,
		input.lastTaskDoneAt,
		input.lastProjectActivityAt,
		input.lastNoteAt,
	].reduce<string | null>((acc, candidate) => laterOf(acc, candidate ?? null), null);

	const thresholdDays = cadenceThresholdDays(input.failurePatterns);
	const daysSinceTouch = lastTouchUtc === null ? null : daysBetween(lastTouchUtc, input.nowMs);

	// Never touched + has a rule counts as quiet: a domain nothing has ever
	// reached is exactly the case the sweep exists to notice.
	const quiet =
		thresholdDays !== null && (daysSinceTouch === null || daysSinceTouch >= thresholdDays);

	return {
		domainId: input.domainId,
		name: input.name,
		lastTouchUtc,
		daysSinceTouch,
		thresholdDays,
		openTasks: input.openTasks,
		quiet,
	};
}

type MaxByDomain = Map<string, string>;

function foldMax(rows: Array<{ domain_id: string | null; at: string | null }>): MaxByDomain {
	const out: MaxByDomain = new Map();
	for (const row of rows) {
		if (row.domain_id === null || row.at === null) continue;
		const current = out.get(row.domain_id) ?? null;
		const next = laterOf(current, row.at);
		if (next !== null) out.set(row.domain_id, next);
	}
	return out;
}

/**
 * Last touch + open task count for every active domain. Feeds both the cron
 * (§04) and the /domains rows and stat band (§05).
 */
export async function listDomainTouches(
	sb: SupabaseClient,
	nowMs: number = Date.now(),
): Promise<DomainTouch[]> {
	const [domains, taskRows, projectRows] = await Promise.all([
		listDomains(sb),
		unwrap(await sb.from("tasks").select("domain_id, status, completed_at")) as Array<{
			domain_id: string | null;
			status: string;
			completed_at: string | null;
		}> | null,
		unwrap(await sb.from("projects").select("domain_id, updated_at")) as Array<{
			domain_id: string | null;
			updated_at: string | null;
		}> | null,
	]);

	const tasks = taskRows ?? [];
	const lastTaskDone = foldMax(tasks.map((t) => ({ domain_id: t.domain_id, at: t.completed_at })));
	const lastProject = foldMax(
		(projectRows ?? []).map((p) => ({ domain_id: p.domain_id, at: p.updated_at })),
	);
	// notes.domain_id does not exist yet — P3 adds the column and this source.
	const lastNote: MaxByDomain = new Map();

	const openByDomain = new Map<string, number>();
	for (const t of tasks) {
		if (t.domain_id === null || t.status !== "open") continue;
		openByDomain.set(t.domain_id, (openByDomain.get(t.domain_id) ?? 0) + 1);
	}

	return domains.map((d) =>
		resolveTouch({
			domainId: d.id,
			name: d.name,
			failurePatterns: d.failure_patterns,
			lastShippedAt: d.last_shipped_at,
			lastTaskDoneAt: lastTaskDone.get(d.id) ?? null,
			lastProjectActivityAt: lastProject.get(d.id) ?? null,
			lastNoteAt: lastNote.get(d.id) ?? null,
			openTasks: openByDomain.get(d.id) ?? 0,
			nowMs,
		}),
	);
}

/** Domain ids that already carry an open (undismissed) neglect observation. */
async function openNeglectDomainIds(sb: SupabaseClient): Promise<Set<string>> {
	const rows = unwrap(
		await sb
			.from("observations")
			.select("domain_id")
			.eq("type", NEGLECT_OBSERVATION_TYPE)
			.is("dismissed_at", null),
	) as Array<{ domain_id: string | null }> | null;
	return new Set((rows ?? []).flatMap((r) => (r.domain_id === null ? [] : [r.domain_id])));
}

export function neglectObservationBody(touch: DomainTouch): string {
	const threshold = `flags after ${touch.thresholdDays} day${touch.thresholdDays === 1 ? "" : "s"}`;
	if (touch.daysSinceTouch === null) return `Never touched — ${threshold}.`;
	return `${touch.daysSinceTouch} day${touch.daysSinceTouch === 1 ? "" : "s"} since the last touch — ${threshold}.`;
}

/**
 * One tick of the sweep. Flags every quiet domain that is not already flagged,
 * and resolves the observation of any domain that has since been touched, so
 * the ledger reflects the present rather than accumulating stale alarms.
 */
export async function sweepNeglect(
	sb: SupabaseClient,
	nowMs: number = Date.now(),
): Promise<{ flagged: DomainTouch[]; resolved: number }> {
	const touches = await listDomainTouches(sb, nowMs);
	const alreadyFlagged = await openNeglectDomainIds(sb);

	const toFlag = touches.filter((t) => t.quiet && !alreadyFlagged.has(t.domainId));
	const toResolve = touches
		.filter((t) => !t.quiet && alreadyFlagged.has(t.domainId))
		.map((t) => t.domainId);

	if (toFlag.length > 0) {
		unwrap(
			await sb.from("observations").insert(
				toFlag.map((t) => ({
					type: NEGLECT_OBSERVATION_TYPE,
					severity: "notable",
					title: `${t.name} has gone quiet`,
					body: neglectObservationBody(t),
					domain_id: t.domainId,
					supporting_data: {
						days_since_touch: t.daysSinceTouch,
						threshold_days: t.thresholdDays,
						last_touch_at: t.lastTouchUtc,
						open_tasks: t.openTasks,
					},
				})),
			),
		);
	}

	if (toResolve.length > 0) {
		unwrap(
			await sb
				.from("observations")
				.update({ dismissed_at: new Date(nowMs).toISOString(), acted_on: true })
				.eq("type", NEGLECT_OBSERVATION_TYPE)
				.is("dismissed_at", null)
				.in("domain_id", toResolve),
		);
	}

	return { flagged: toFlag, resolved: toResolve.length };
}
