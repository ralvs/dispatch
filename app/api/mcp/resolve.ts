import type { SupabaseClient } from "@supabase/supabase-js";
import { listDomains } from "@/lib/services/domains";
import { listProjects } from "@/lib/services/projects";
import { ToolError } from "./contract";

// An assistant names a project or domain the way the owner does: by name.
// Ids still work, so a value read back from another tool passes straight
// through. Anything else is a ToolError that lists what would have matched,
// so the model can correct itself in one turn (docs/adr/0079).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The domain answer for "inbox": the task has no domain at all (docs/adr/0027). */
export const UNFILED = Symbol("unfiled");

type Named = { id: string; name: string };

function match<T extends Named>(rows: T[], idOrName: string, kind: string): T {
	const key = idOrName.trim();
	const found = UUID.test(key)
		? rows.find((r) => r.id.toLowerCase() === key.toLowerCase())
		: rows.find((r) => r.name.toLowerCase() === key.toLowerCase());
	if (found) return found;
	const names = rows.map((r) => r.name).join(", ") || "none";
	throw new ToolError(`No ${kind} named "${key}". Valid ${kind}s: ${names}.`);
}

export async function resolveProject(sb: SupabaseClient, idOrName: string): Promise<Named> {
	return match(await listProjects(sb), idOrName, "project");
}

export async function resolveDomain(
	sb: SupabaseClient,
	idOrName: string,
): Promise<Named | typeof UNFILED> {
	if (idOrName.trim().toLowerCase() === "inbox") return UNFILED;
	return match(await listDomains(sb), idOrName, "domain");
}
