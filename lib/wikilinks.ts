// Wikilink markdown syntax: `[[<uuid>|<label>]]`. The uuid is the target
// note's stable id; the label is a display snapshot taken at insert time
// (renames never rewrite other notes' bodies — see docs/adr for phase 2).
// Client-safe: no "server-only" import, used by both the editor (client)
// and the save action (server).

const UUID_SOURCE = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/** Matches `[[uuid|label]]`. Label is anything but `]]`, `|`, or a newline. */
export const WIKILINK_RE = new RegExp(`\\[\\[(${UUID_SOURCE})\\|([^\\]|\\n]+)\\]\\]`, "g");

/** All target note ids referenced in `markdown`, deduped, first-appearance order. */
export function extractWikilinkIds(markdown: string): string[] {
	const ids: string[] = [];
	const seen = new Set<string>();
	for (const match of markdown.matchAll(WIKILINK_RE)) {
		const id = match[1];
		if (id === undefined || seen.has(id)) continue;
		seen.add(id);
		ids.push(id);
	}
	return ids;
}

/** Strips `|`, `[`, `]`, and newlines; collapses whitespace; falls back to "Untitled". */
export function sanitizeLabel(label: string): string {
	const cleaned = label
		.replace(/[|[\]]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return cleaned || "Untitled";
}

/** Serializes a wikilink node to its markdown source, sanitizing the label. */
export function serializeWikilink(id: string, label: string): string {
	return `[[${id}|${sanitizeLabel(label)}]]`;
}
