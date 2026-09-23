/**
 * Link metadata backfill — re-reads title, description and preview image for
 * links saved before the fetcher learned about them (docs/adr/0064).
 *
 * Capture only enriches a link once, at save time. When the fetcher improves,
 * the rows already on /links keep what the old one found — for X posts that is
 * "Name (@handle) on X" and a t.co link. This runs the current fetcher over
 * every saved link.
 *
 * Dry run by default: it prints what would change and writes nothing.
 *
 *   set -a && . ./.env.local && set +a && bun run backfill:links
 *   set -a && . ./.env.local && set +a && bun run backfill:links --write
 *
 * A field the fetcher cannot resolve now keeps its old value — a host that is
 * down today does not erase a title it gave last month. Makes no AI calls.
 */

import { fetchLinkMetadata } from "@/lib/links/metadata";
import { listLinks, updateLinkMetadata } from "@/lib/services/links";
import { createAdminClient } from "@/lib/supabase/admin";

const write = process.argv.includes("--write");
const sb = createAdminClient();
const links = await listLinks(sb);

let changed = 0;
let failed = 0;
for (const link of links) {
	const meta = await fetchLinkMetadata(link.url);
	const next = {
		title: meta.title ?? link.title,
		description: meta.description ?? link.description,
		image: meta.image ?? link.image_url,
	};
	if (
		next.title === link.title &&
		next.description === link.description &&
		next.image === link.image_url
	) {
		continue;
	}

	changed++;
	console.info(`\n${link.url}`);
	console.info(`  title  ${JSON.stringify(link.title)} → ${JSON.stringify(next.title)}`);
	console.info(`  image  ${link.image_url ?? "—"} → ${next.image ?? "—"}`);
	if (next.description !== link.description) console.info("  text   changed");
	if (!write) continue;
	try {
		await updateLinkMetadata(sb, link.id, next);
	} catch (error) {
		// One bad row should not stop the rest; it is reported and left as it was.
		failed++;
		console.error(`  write failed: ${error instanceof Error ? error.message : String(error)}`);
	}
}

console.info(
	`\n${changed} of ${links.length} links ${write ? "changed" : "would change (dry run; pass --write)"}${failed ? `, ${failed} failed to write` : ""}.`,
);
if (failed) process.exitCode = 1;
