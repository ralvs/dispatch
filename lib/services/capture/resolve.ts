import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParseContext } from "@/lib/ai/parser";
import { nowUtc, todayInTz } from "@/lib/dates";
import type { CreateTaskAction } from "@/lib/schemas/capture";
import { listDomains } from "@/lib/services/domains";
import { listProjects } from "@/lib/services/projects";
import { getAppTimezone } from "@/lib/services/settings";
import type { createTask } from "@/lib/services/tasks";

// ─────────────────────────────────────────────────────────────────────────
// What both write paths need around a parse — the capture pipeline
// (docs/adr/0008) and the /tasks quick-add (docs/adr/0019 D3), which stay
// separate orchestrations sharing only what is below. Two halves:
//
//   Pure (no sb): name → id routing resolution, and the create_task →
//   createTask mapping built on it.
//   DB-backed (sb first, iron rule #3): the routing lists and the parse
//   context assembled from them.
//
// Routing is name-based because the parser is only ever given names (never
// ids — hallucinated-UUID risk), so matching is exact, case- and
// diacritic-insensitive only. No fuzzy match (deferred per ADR-0016's
// match.ts). A miss never fails the capture: it falls back to the Inbox and
// records the miss for filing there.
// ─────────────────────────────────────────────────────────────────────────

export type RoutingLists = {
	domains: { id: string; name: string }[];
	projects: { id: string; name: string; domain_id: string | null }[];
};

export type TaskRouting = {
	domain_id: string | null;
	project_id: string | null;
	// Human-readable mentions that named a domain/project with no match, e.g.
	// `project "Reviews plugin"` — the executor folds these into task notes.
	unresolved: string[];
};

function normalize(s: string): string {
	return s
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
}

/**
 * Resolves an action's `domain`/`project` names to ids. A resolved project
 * inherits its domain; an explicitly resolved domain wins over that
 * inheritance. Unresolved names are reported, never guessed.
 */
export function resolveTaskRouting(action: CreateTaskAction, lists: RoutingLists): TaskRouting {
	let domain_id: string | null = null;
	let project_id: string | null = null;
	const unresolved: string[] = [];

	if (action.project) {
		const norm = normalize(action.project);
		const match = lists.projects.find((p) => normalize(p.name) === norm);
		if (match) {
			project_id = match.id;
			domain_id = match.domain_id;
		} else {
			unresolved.push(`project "${action.project}"`);
		}
	}

	if (action.domain) {
		const norm = normalize(action.domain);
		const match = lists.domains.find((d) => normalize(d.name) === norm);
		if (match) {
			domain_id = match.id;
		} else {
			unresolved.push(`domain "${action.domain}"`);
		}
	}

	return { domain_id, project_id, unresolved };
}

/** Appends unresolved routing mentions to task notes, e.g. `[capture: unresolved project "X"]`. */
export function withUnresolvedNotes(
	notes: string | undefined,
	unresolved: string[],
): string | null {
	if (unresolved.length === 0) return notes ?? null;
	const suffix = unresolved.map((u) => `[capture: unresolved ${u}]`).join(" ");
	return notes ? `${notes}\n${suffix}` : suffix;
}

/**
 * The single create_task → createTask mapping, shared by both write paths: the
 * capture executor (docs/adr/0008) and the /tasks quick-add orchestrator
 * (docs/adr/0019 D3). Those two stay deliberately separate orchestrations —
 * only this argument mapping is common, so a field added to
 * CreateTaskActionSchema reaches both paths from one edit.
 *
 * Pure: no `sb`, no I/O. Routing is resolved here because neither caller needs
 * the TaskRouting for anything but this payload.
 */
export function taskInputFromAction(
	action: CreateTaskAction,
	lists: RoutingLists,
): Parameters<typeof createTask>[1] {
	const routing = resolveTaskRouting(action, lists);
	return {
		title: action.title,
		notes: withUnresolvedNotes(action.notes, routing.unresolved),
		due_date: action.due_date ?? null,
		due_time: action.due_time ?? null,
		priority: action.priority,
		domain_id: routing.domain_id,
		project_id: routing.project_id,
		recurrence_rule: action.recurrence_rule ?? null,
		source: "manual",
	};
}

/**
 * Fetches the routing lists a capture can name: non-system domains, active
 * projects. Guarded — a `listDomains`/`listProjects` hiccup never degrades
 * the whole capture, it just yields no routing (docs/adr/0019 D2).
 */
export async function fetchRoutingLists(sb: SupabaseClient): Promise<RoutingLists> {
	try {
		const [domains, projects] = await Promise.all([
			listDomains(sb),
			listProjects(sb, { status: "active" }),
		]);
		return {
			domains: domains.filter((d) => !d.is_system).map((d) => ({ id: d.id, name: d.name })),
			projects: projects.map((p) => ({ id: p.id, name: p.name, domain_id: p.domain_id })),
		};
	} catch {
		return { domains: [], projects: [] };
	}
}

/**
 * Everything a parse needs from the database, assembled once: the app timezone
 * (iron rule #1 — relative dates resolve against it, never against the server
 * clock) and the routing candidates the prompt injects.
 *
 * Returns `tz` and `routing` alongside the ParseContext because callers need
 * them after parsing — capture() to build Provenance, quickAddTask() to map
 * the parsed task. Inherits fetchRoutingLists's guard: a routing hiccup yields
 * empty lists, never a failed capture.
 */
export async function loadCaptureContext(
	sb: SupabaseClient,
): Promise<{ tz: string; routing: RoutingLists; ctx: ParseContext }> {
	const tz = await getAppTimezone(sb);
	const routing = await fetchRoutingLists(sb);
	return {
		tz,
		routing,
		ctx: {
			tz,
			todayIso: todayInTz(tz),
			nowUtc: nowUtc(),
			domains: routing.domains.map((d) => d.name),
			projects: routing.projects.map((p) => p.name),
		},
	};
}
