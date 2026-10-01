import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { nowUtc } from "@/lib/dates";
import { ROUTINE_HISTORY_DAYS, withHistory } from "@/lib/routine-stats";
import {
	COMPLETION_SELECT,
	type CompletionRow,
	type CreateRoutineSchema,
	ROUTINE_SELECT,
	type RoutineRow,
	type RoutineWithHistory,
	type UpdateRoutineSchema,
} from "@/lib/schemas/routine";
import { unwrap } from "@/lib/services/errors";

// ─── Routines ───────────────────────────────────────────────────────────

export type { CompletionRow, RoutineRow };

export type CreateRoutineInput = z.infer<typeof CreateRoutineSchema>;
export type UpdateRoutineInput = z.infer<typeof UpdateRoutineSchema>;

export async function listRoutines(
	sb: SupabaseClient,
	filters: { includeArchived?: boolean } = {},
): Promise<RoutineRow[]> {
	let q = sb
		.from("routines")
		.select(ROUTINE_SELECT)
		.order("active", { ascending: false })
		.order("position", { ascending: true });
	if (!filters.includeArchived) q = q.is("archived_at", null);
	const data = unwrap(await q);
	return (data ?? []) as unknown as RoutineRow[];
}

export async function getRoutine(sb: SupabaseClient, id: string): Promise<RoutineRow | null> {
	const data = unwrap(await sb.from("routines").select(ROUTINE_SELECT).eq("id", id).maybeSingle());
	return (data as unknown as RoutineRow | null) ?? null;
}

/**
 * One routine with its completion log since `sinceIso` — the row a routine
 * write returns to the entity store (#29). Null when the routine is gone.
 */
export async function getRoutineWithHistory(
	sb: SupabaseClient,
	id: string,
	sinceIso: string,
): Promise<RoutineWithHistory | null> {
	const [routine, byRoutine] = await Promise.all([
		getRoutine(sb, id),
		listCompletionsForRoutines(sb, [id], sinceIso),
	]);
	return routine ? withHistory([routine], byRoutine[id] ?? [])[0] : null;
}

export async function createRoutine(
	sb: SupabaseClient,
	input: CreateRoutineInput,
): Promise<RoutineRow> {
	const data = unwrap(await sb.from("routines").insert(input).select(ROUTINE_SELECT).single());
	return data as unknown as RoutineRow;
}

export async function updateRoutine(
	sb: SupabaseClient,
	id: string,
	patch: UpdateRoutineInput,
): Promise<void> {
	unwrap(await sb.from("routines").update(patch).eq("id", id));
}

/** Deletes the routine; completions cascade via FK (on delete cascade). */
export async function deleteRoutine(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("routines").delete().eq("id", id));
}

export async function archiveRoutine(
	sb: SupabaseClient,
	id: string,
	archived: boolean,
): Promise<void> {
	unwrap(
		await sb
			.from("routines")
			.update({ archived_at: archived ? nowUtc() : null })
			.eq("id", id),
	);
}

// ─── Routine completions ────────────────────────────────────────────────

export async function listCompletions(
	sb: SupabaseClient,
	routineId: string,
	sinceIso?: string,
): Promise<CompletionRow[]> {
	let q = sb
		.from("routine_completions")
		.select(COMPLETION_SELECT)
		.eq("routine_id", routineId)
		.order("completed_date", { ascending: true });
	if (sinceIso) q = q.gte("completed_date", sinceIso);
	const data = unwrap(await q);
	return (data ?? []) as unknown as CompletionRow[];
}

/**
 * Completions for a batch of routines since a calendar date, grouped by
 * routine id. One query instead of one-per-routine (the routines page used
 * to fan out listCompletions per row).
 */
export async function listCompletionsForRoutines(
	sb: SupabaseClient,
	routineIds: string[],
	sinceIso?: string,
): Promise<Record<string, CompletionRow[]>> {
	if (routineIds.length === 0) return {};
	// PostgREST caps a response at 1000 rows (supabase/config.toml max_rows),
	// whatever .limit() asks. Callers ask for the ROUTINE_HISTORY_DAYS window,
	// which a large, fully-kept set of routines can pass. Read newest first, so
	// whatever a cap drops is the oldest days — long streaks — never today or
	// the 30-day grid. Returned oldest first, as before.
	const windowDays = ROUTINE_HISTORY_DAYS + 1;
	let q = sb
		.from("routine_completions")
		.select(COMPLETION_SELECT)
		.in("routine_id", routineIds)
		.limit(routineIds.length * windowDays);
	if (sinceIso) q = q.gte("completed_date", sinceIso);
	q = q.order("completed_date", { ascending: false });
	const data = unwrap(await q);
	const byRoutine: Record<string, CompletionRow[]> = {};
	for (const row of ((data ?? []) as unknown as CompletionRow[]).reverse()) {
		if (!byRoutine[row.routine_id]) byRoutine[row.routine_id] = [];
		byRoutine[row.routine_id].push(row);
	}
	return byRoutine;
}

/**
 * All completions since a calendar date, across routines — streak math input.
 * Read newest first so the 1000-row response cap can only drop the oldest
 * days (see listCompletionsForRoutines); returned oldest first.
 */
export async function listCompletionsSince(
	sb: SupabaseClient,
	sinceIso: string,
): Promise<CompletionRow[]> {
	const data = unwrap(
		await sb
			.from("routine_completions")
			.select(COMPLETION_SELECT)
			.gte("completed_date", sinceIso)
			.order("completed_date", { ascending: false }),
	);
	return ((data ?? []) as unknown as CompletionRow[]).reverse();
}

/** All completions recorded for a single calendar date, across routines. */
export async function listCompletionsOn(
	sb: SupabaseClient,
	dateIso: string,
): Promise<CompletionRow[]> {
	const data = unwrap(
		await sb.from("routine_completions").select(COMPLETION_SELECT).eq("completed_date", dateIso),
	);
	return (data ?? []) as unknown as CompletionRow[];
}

/**
 * Toggle a single day's completion. done=true upserts (double-tap is a
 * no-op via ignoreDuplicates); done=false deletes the pair (missing row is
 * a silent no-op).
 */
export async function setCompletion(
	sb: SupabaseClient,
	routineId: string,
	dateIso: string,
	done: boolean,
): Promise<void> {
	if (done) {
		unwrap(
			await sb
				.from("routine_completions")
				.upsert(
					{ routine_id: routineId, completed_date: dateIso },
					{ onConflict: "routine_id,completed_date", ignoreDuplicates: true },
				),
		);
		return;
	}
	unwrap(
		await sb
			.from("routine_completions")
			.delete()
			.eq("routine_id", routineId)
			.eq("completed_date", dateIso),
	);
}
