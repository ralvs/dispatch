import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { nowUtc } from "@/lib/dates";
import type { TimeOfDayBucketSchema } from "@/lib/schemas/routine";
import { unwrap } from "@/lib/services/errors";

// ─── Routines ───────────────────────────────────────────────────────────

const ROUTINE_SELECT =
	"id, name, description, position, active, time_of_day, specific_time, reminder_enabled, last_reminder_sent_date, goal_days, archived_at, created_at, updated_at";

export type RoutineRow = {
	id: string;
	name: string;
	description: string | null;
	position: number;
	active: boolean;
	time_of_day: z.infer<typeof TimeOfDayBucketSchema>;
	specific_time: string | null;
	reminder_enabled: boolean;
	last_reminder_sent_date: string | null;
	goal_days: number | null;
	archived_at: string | null;
	created_at: string;
	updated_at: string;
};

export type CreateRoutineInput = {
	name: string;
	description?: string | null;
	position?: number;
	time_of_day?: z.infer<typeof TimeOfDayBucketSchema>;
	specific_time?: string | null;
	reminder_enabled?: boolean;
	goal_days?: number | null;
};

export type UpdateRoutineInput = Partial<CreateRoutineInput> & {
	active?: boolean;
	archived_at?: string | null;
};

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
	return (data ?? []) as RoutineRow[];
}

export async function getRoutine(sb: SupabaseClient, id: string): Promise<RoutineRow | null> {
	const data = unwrap(await sb.from("routines").select(ROUTINE_SELECT).eq("id", id).maybeSingle());
	return (data as RoutineRow | null) ?? null;
}

export async function createRoutine(
	sb: SupabaseClient,
	input: CreateRoutineInput,
): Promise<RoutineRow> {
	const data = unwrap(await sb.from("routines").insert(input).select(ROUTINE_SELECT).single());
	return data as RoutineRow;
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

const COMPLETION_SELECT = "id, routine_id, completed_date, created_at";

export type CompletionRow = {
	id: string;
	routine_id: string;
	completed_date: string;
	created_at: string;
};

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
	return (data ?? []) as CompletionRow[];
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
	return (data ?? []) as CompletionRow[];
}

/** All completions recorded for a single calendar date, across routines. */
export async function listCompletionsOn(
	sb: SupabaseClient,
	dateIso: string,
): Promise<CompletionRow[]> {
	const data = unwrap(
		await sb.from("routine_completions").select(COMPLETION_SELECT).eq("completed_date", dateIso),
	);
	return (data ?? []) as CompletionRow[];
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
