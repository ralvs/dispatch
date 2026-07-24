import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateTaskAction } from "@/lib/schemas/capture";
import { listDomains } from "@/lib/services/domains";
import { listProjects } from "@/lib/services/projects";

// ─────────────────────────────────────────────────────────────────────────
// Pure, db-free name → id resolution for capture routing (docs/adr/0019 D1).
// The parser is only ever given names (never ids — hallucinated-UUID risk),
// so this is exact, case- and diacritic-insensitive matching only. No fuzzy
// match (deferred per ADR-0016's match.ts). A miss never fails the capture:
// the caller falls back to Inbox and records the miss for triage.
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
