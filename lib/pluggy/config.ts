import "server-only";
import { env } from "@/lib/env";
import { createPluggyClient, type PluggyClient } from "./client";

/** One configured Meu Pluggy connection: the label the owner gave it, and its item id. */
export type ItemRef = { label: string; itemId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parses PLUGGY_ITEM_IDS: `nubank:<uuid>,<uuid>`. A missing label becomes
 * `item-<n>`. Throws on an id that is not a UUID, so a paste error shows up
 * as a clear message instead of a 404 from Pluggy.
 */
export function parseItemIds(raw: string): ItemRef[] {
	const refs = raw
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part, i) => {
			const colon = part.lastIndexOf(":");
			const label = colon === -1 ? `item-${i + 1}` : part.slice(0, colon).trim();
			const itemId = (colon === -1 ? part : part.slice(colon + 1)).trim();
			if (!UUID.test(itemId)) {
				throw new Error(`PLUGGY_ITEM_IDS entry ${i + 1} is not a UUID item id.`);
			}
			return { label: label || `item-${i + 1}`, itemId };
		});
	if (refs.length === 0) throw new Error("PLUGGY_ITEM_IDS has no item id.");
	return refs;
}

let client: PluggyClient | undefined;

/**
 * The process-wide client, so the cached API key outlives one request on a
 * warm function instance. Callers check isPluggyConfigured() first.
 */
export function pluggyClient(): PluggyClient {
	const { PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET } = env();
	if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) throw new Error("Pluggy is not configured.");
	client ??= createPluggyClient({ clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET });
	return client;
}

export function pluggyItems(): ItemRef[] {
	const raw = env().PLUGGY_ITEM_IDS;
	if (!raw) throw new Error("Pluggy is not configured.");
	return parseItemIds(raw);
}
