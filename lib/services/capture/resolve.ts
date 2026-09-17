import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParseContext } from "@/lib/ai/parser";
import { isVerbatim } from "@/lib/ai/verbatim";
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
// match.ts). A miss never fails the capture: the task is left unfiled (no
// domain at all) and the miss is recorded for filing from /inbox.
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
 * carries its own domain; a separately named domain only applies when the
 * project left the question open. Unresolved names are reported, never
 * guessed.
 *
 * A named domain used to override the project's, which stored a pair the data
 * cannot mean: a task in a Work project filed under Home. That was the same
 * defect the task form had, and it reached the database from here — so the
 * rule is now the one the form enforces, applied at the other end.
 *
 * The project wins because it is the more specific claim and both answers come
 * from the same model: naming a project already names a domain, so a
 * contradicting domain is the model's mistake, not a refinement. (Where the
 * domain is stated by a HUMAN, the opposite is true and the human wins — that
 * is quick-add's `withStatedDomain`, which drops the project instead.)
 */
export function resolveTaskRouting(
	action: CreateTaskAction,
	lists: RoutingLists,
	text?: string,
): TaskRouting {
	let domain_id: string | null = null;
	let project_id: string | null = null;
	let domainFromProject = false;
	const unresolved: string[] = [];

	/**
	 * Whether an unmatched name is worth reporting, or is the model filling a
	 * field it was told to leave out.
	 *
	 * The prompt has been told four ways not to write a stand-in, and the model
	 * still does: `project` has come back as `""`, `":"`, `","`, `"#OMIT#"` and
	 * `"skip"` on utterances that named no project at all. The schema's
	 * `OptionalText` catches the punctuation ones; a word-shaped stand-in walks
	 * straight past it and lands in the task's notes as a bogus
	 * `[capture: unresolved project "skip"]`.
	 *
	 * The test that separates the two is whether the user said it. A genuine
	 * miss is a name from the utterance that this app has no row for yet — "the
	 * Reviews plugin" — and that is real signal worth carrying to `/inbox`. A
	 * name that appears in neither the known list nor the user's own words is
	 * from nowhere, and nowhere is not a destination.
	 *
	 * Without `text` (a caller that has no utterance to check against) every
	 * unmatched name is reported, which is the behaviour this had before.
	 */
	const worthReporting = (name: string) => text === undefined || isVerbatim(name, text);

	if (action.project) {
		const norm = normalize(action.project);
		const match = lists.projects.find((p) => normalize(p.name) === norm);
		if (match) {
			project_id = match.id;
			domain_id = match.domain_id;
			// A project with no domain settles nothing, so a named domain may
			// still answer — it cannot contradict what was never stated.
			domainFromProject = match.domain_id !== null;
		} else if (worthReporting(action.project)) {
			unresolved.push(`project "${action.project}"`);
		}
	}

	if (action.domain) {
		const norm = normalize(action.domain);
		const match = lists.domains.find((d) => normalize(d.name) === norm);
		if (match) {
			if (!domainFromProject) domain_id = match.id;
		} else if (worthReporting(action.domain)) {
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
	text?: string,
): Parameters<typeof createTask>[1] {
	const routing = resolveTaskRouting(action, lists, text);
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
			domains: domains.map((d) => ({ id: d.id, name: d.name })),
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
	const [tz, routing] = await Promise.all([getAppTimezone(sb), fetchRoutingLists(sb)]);
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
