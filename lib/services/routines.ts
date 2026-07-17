import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { nowUtc } from "@/lib/dates";
import {
	COMPLETION_SELECT,
	type CompletionRow,
	type CreateRoutineSchema,
	ROUTINE_SELECT,
	type RoutineRow,
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

/** All completions since a calendar date, across routines — streak math input. */
export async function listCompletionsSince(
	sb: SupabaseClient,
	sinceIso: string,
): Promise<CompletionRow[]> {
	const data = unwrap(
		await sb
			.from("routine_completions")
			.select(COMPLETION_SELECT)
			.gte("completed_date", sinceIso)
			.order("completed_date", { ascending: true }),
	);
	return (data ?? []) as unknown as CompletionRow[];
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
