import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaptureAction } from "@/lib/schemas/capture";
import type { ActionResult } from "@/lib/services/capture";
import { createNeedsReviewNote, createNote } from "@/lib/services/notes";
import { createQuote } from "@/lib/services/quotes";
import { createTask } from "@/lib/services/tasks";

// ─────────────────────────────────────────────────────────────────────────
// Turns parsed capture actions into service calls, one at a time, each fully
// isolated: a failure of one action (a service error, or the parser's explicit
// needs_review verb) degrades ONLY that action to a needs_review note and the
// loop continues — one bad action of three never loses the other two. Nothing
// here throws into the capture path; the raw is already durable regardless.
// ─────────────────────────────────────────────────────────────────────────

export type Provenance = {
	capturedId: string;
	// The verbatim transcript — the body used when an action degrades, so
	// content is preserved as-spoken with no model in the loop.
	transcript: string;
};

async function degrade(
	sb: SupabaseClient,
	prov: Provenance,
	action: string,
	reason: string,
	proposedKind?: string,
): Promise<ActionResult> {
	let noteId = "";
	try {
		const note = await createNeedsReviewNote(sb, {
			body: prov.transcript,
			origin_capture_id: prov.capturedId,
			reason,
			proposed_kind: proposedKind,
		});
		noteId = note.id;
	} catch {
		// Even the safety-net note failed. The raw capture is still in
		// captured_data, so nothing is lost — surface an empty noteId.
	}
	return { action, ok: false, reason, noteId };
}

async function runOne(
	sb: SupabaseClient,
	action: CaptureAction,
	prov: Provenance,
): Promise<ActionResult> {
	try {
		switch (action.action) {
			case "create_task": {
				const task = await createTask(sb, {
					title: action.title,
					due_date: action.due_date ?? null,
					due_time: action.due_time ?? null,
					priority: action.priority,
					source: "voice_capture",
				});
				return { action: "create_task", ok: true, entity: { table: "tasks", id: task.id } };
			}
			case "create_note": {
				const note = await createNote(sb, {
					body: action.body,
					source_type: action.source_type,
					tags: action.tags,
					origin_capture_id: prov.capturedId,
				});
				return { action: "create_note", ok: true, entity: { table: "notes", id: note.id } };
			}
			case "create_quote": {
				const q = await createQuote(sb, {
					text: action.text,
					source_type: action.source_type ?? null,
					source_author: action.source_author ?? null,
					tags: action.tags,
					added_via: "voice",
				});
				return { action: "create_quote", ok: true, entity: { table: "quotes", id: q.id } };
			}
			case "needs_review":
				return degrade(sb, prov, "needs_review", action.reason, action.proposed_kind);
		}
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		return degrade(sb, prov, action.action, reason);
	}
}

export async function runActions(
	sb: SupabaseClient,
	actions: CaptureAction[],
	prov: Provenance,
): Promise<ActionResult[]> {
	const results: ActionResult[] = [];
	for (const action of actions) {
		results.push(await runOne(sb, action, prov));
	}
	return results;
}
