import type { TaskRow } from "@/lib/schemas/task";
import type { DaySchedule, DayScheduleItem, DaySchedulePayload } from "@/lib/services/today";

/** `content` is real data; `time` is the clock. Split so a write is
 *  distinguishable from a SoftRefresh tick. */
export type DaySignature = { content: string; time: string };

export type DayCacheEntry = {
	payload: DaySchedulePayload;
	signature: DaySignature;
	fetchedAtMs: number;
};

/** Backstop only — writes evict other days directly via a content change.
 *  Covers cron-originated edits, which produce no revalidatePath here. */
export const REVALIDATE_AFTER_MS = 60_000;
export const MAX_CACHED_DAYS = 21;

/** Fields that change a task row's on-screen appearance anywhere it can
 * render on Today (schedule bands, top3, open) — id for identity, the rest
 * per task-row.tsx / day-schedule.tsx. */
function projectTask(task: TaskRow) {
	return {
		id: task.id,
		status: task.status,
		title: task.title,
		top3_for_date: task.top3_for_date,
		priority: task.priority,
		domainId: task.domain?.id ?? null,
		domainName: task.domain?.name ?? null,
		domainColor: task.domain?.color ?? null,
		projectName: task.project?.name ?? null,
		due_date: task.due_date,
		due_time: task.due_time,
		recurrence_rule: task.recurrence_rule,
	};
}

/** Fields that change an event row's on-screen appearance (schedule-row.tsx). */
function projectEvent(event: DayScheduleItem & { kind: "event" }) {
	return {
		id: event.event.id,
		title: event.event.title,
		end_at: event.event.end_at,
		calendar_name: event.event.calendar_name,
		location: event.event.location,
	};
}

function projectItem(item: DayScheduleItem) {
	return {
		kind: item.kind,
		key: item.key,
		time: item.time,
		...(item.kind === "task" ? { task: projectTask(item.task) } : { event: projectEvent(item) }),
	};
}

/** Object.fromEntries key order follows Postgres row order, not anything
 * meaningful — sort before serialising or the signature spuriously differs. */
function sortedEntries(record: Record<string, string>): [string, string][] {
	return Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function projectSchedule(schedule: DaySchedule) {
	return {
		allDay: schedule.allDay.map(projectItem),
		timeline: schedule.timeline.map(projectItem),
		top3: schedule.top3.map(projectTask),
		open: schedule.open.map(projectTask),
	};
}

/**
 * Two strings, not one. `content` answers "did server data actually move?";
 * `time` is the clock. A write changes `content` and evicts other cached
 * days; a SoftRefresh tick on today changes only `time`. See
 * lib/day-nav/revalidation.test.ts for the cases this split exists to cover.
 */
export function daySignature(payload: DaySchedulePayload): DaySignature {
	const content = JSON.stringify({
		dateIso: payload.dateIso,
		...projectSchedule(payload.schedule),
		eventNoteIds: sortedEntries(payload.eventNoteIds),
		taskNoteIds: sortedEntries(payload.taskNoteIds),
	});

	// nowLabel === null is the module's "not today" signal (today-body.tsx
	// / actions.ts only populate it on the real today) — off-today the
	// now-marker isn't drawn and dimming is uniform, so time must not
	// contribute there. Truncate to the minute: nowUtcIso's only consumer is
	// past-event dimming (day-tape.tsx:330), where sub-minute precision is
	// invisible. No Date round-trip — slicing a UTC ISO instant is safe
	// precisely because it's UTC; timezone conversion stays server-side.
	const time =
		payload.nowLabel === null ? "" : `${payload.nowUtcIso.slice(0, 16)}|${payload.nowLabel}`;

	return { content, time };
}

export type DayReadDecision =
	| { kind: "miss" }
	| { kind: "hit"; entry: DayCacheEntry; revalidate: boolean };

/**
 * Cache-hit-wins, always: an aged entry is still a hit, never a miss — we
 * must never show a skeleton for content already seen. Staleness only sets
 * `revalidate: true`.
 */
export function readDay(
	cache: ReadonlyMap<string, DayCacheEntry>,
	dateIso: string,
	nowMs: number,
	revalidateAfterMs: number = REVALIDATE_AFTER_MS,
): DayReadDecision {
	const entry = cache.get(dateIso);
	if (!entry) return { kind: "miss" };
	const age = nowMs - entry.fetchedAtMs;
	return { kind: "hit", entry, revalidate: age >= revalidateAfterMs };
}

/**
 * Whether a resolved background result should be swapped onto the screen:
 * only when it's for the day currently visible AND the signature actually
 * differs. Caching it is unconditional and is the caller's job — an
 * out-of-order or unchanged response still updates the cache, silently.
 */
export function reconcileDay(args: {
	incomingSignature: DaySignature;
	incomingDateIso: string;
	visibleDateIso: string;
	visibleSignature: DaySignature;
}): { adopt: boolean } {
	const { incomingSignature, incomingDateIso, visibleDateIso, visibleSignature } = args;
	const sameDay = incomingDateIso === visibleDateIso;
	const changed =
		incomingSignature.content !== visibleSignature.content ||
		incomingSignature.time !== visibleSignature.time;
	return { adopt: sameDay && changed };
}

/** Keys to drop, oldest-first by fetchedAtMs, never including `protect`.
 * Pure — the caller deletes. */
export function keysToEvict(
	cache: ReadonlyMap<string, DayCacheEntry>,
	max: number,
	protect: string,
): string[] {
	const evictable = [...cache.entries()].filter(([key]) => key !== protect);
	const overBy = cache.size - max;
	if (overBy <= 0) return [];
	return evictable
		.sort((a, b) => a[1].fetchedAtMs - b[1].fetchedAtMs)
		.slice(0, overBy)
		.map(([key]) => key);
}
