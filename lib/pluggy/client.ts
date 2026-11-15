import type { z } from "zod";
import {
	AccountSchema,
	AuthResponseSchema,
	BillSchema,
	ItemSchema,
	type PluggyAccount,
	type PluggyBill,
	type PluggyItem,
	type PluggyTransaction,
	pageSchema,
	TransactionCursorPageSchema,
} from "./schemas";

// ─────────────────────────────────────────────────────────────────────────
// A read-only Pluggy API client (docs/adr/0096). Only GET reads and the
// POST /auth that mints the API key; no write, payment or Pix endpoint is
// wrapped here, and none may be added.
//
// The API key lives two hours (docs.pluggy.ai/docs/authentication). It is
// cached in memory and minted again ten minutes before that, or once on a
// 401. Errors name the method, path and status only: never a query string
// (account ids), a body, or the key.
// ─────────────────────────────────────────────────────────────────────────

export const PLUGGY_BASE_URL = "https://api.pluggy.ai";
/** Pluggy's API key TTL is two hours; refresh with ten minutes to spare. */
export const API_KEY_TTL_MS = 110 * 60 * 1000;
const TIMEOUT_MS = 15_000;
/** A guard against a cursor that never ends; 200 pages of 500 is 100k rows. */
const MAX_PAGES = 200;

export class PluggyError extends Error {
	override name = "PluggyError";
	constructor(
		message: string,
		readonly status?: number,
	) {
		super(message);
	}
}

export type PluggyClientOptions = {
	clientId: string;
	clientSecret: string;
	fetch?: typeof fetch;
	now?: () => number;
	baseUrl?: string;
};

export type TransactionQuery = { accountId: string; from?: string; to?: string };

export type PluggyClient = {
	getItem(itemId: string): Promise<PluggyItem>;
	listAccounts(itemId: string): Promise<PluggyAccount[]>;
	listTransactions(query: TransactionQuery): Promise<PluggyTransaction[]>;
	listBills(accountId: string): Promise<PluggyBill[]>;
};

export function createPluggyClient(options: PluggyClientOptions): PluggyClient {
	const doFetch = options.fetch ?? fetch;
	const now = options.now ?? Date.now;
	const baseUrl = options.baseUrl ?? PLUGGY_BASE_URL;
	let cached: { apiKey: string; expiresAt: number } | null = null;
	let inflight: Promise<string> | null = null;

	async function mintApiKey(): Promise<string> {
		const res = await doFetch(`${baseUrl}/auth`, {
			method: "POST",
			headers: { "content-type": "application/json", accept: "application/json" },
			body: JSON.stringify({ clientId: options.clientId, clientSecret: options.clientSecret }),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!res.ok) throw new PluggyError(`Pluggy POST /auth failed: ${res.status}`, res.status);
		const parsed = AuthResponseSchema.safeParse(await res.json());
		if (!parsed.success) throw new PluggyError("Pluggy POST /auth answered without an apiKey");
		cached = { apiKey: parsed.data.apiKey, expiresAt: now() + API_KEY_TTL_MS };
		return parsed.data.apiKey;
	}

	/** One mint at a time: parallel tool reads share the same key. */
	function apiKey(): Promise<string> {
		if (cached && now() < cached.expiresAt) return Promise.resolve(cached.apiKey);
		inflight ??= mintApiKey().finally(() => {
			inflight = null;
		});
		return inflight;
	}

	async function get<S extends z.ZodType>(
		path: string,
		params: Record<string, string | undefined>,
		schema: S,
	): Promise<z.infer<S>> {
		const url = new URL(path, baseUrl);
		for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);

		const send = async (key: string) =>
			doFetch(url, {
				headers: { "X-API-KEY": key, accept: "application/json" },
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});

		let res = await send(await apiKey());
		if (res.status === 401) {
			// The key expired early or was revoked: mint once and retry once.
			cached = null;
			res = await send(await apiKey());
		}
		if (!res.ok) throw new PluggyError(`Pluggy GET ${path} failed: ${res.status}`, res.status);
		const parsed = schema.safeParse(await res.json());
		if (!parsed.success) {
			const where = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
			throw new PluggyError(`Pluggy GET ${path} answered an unexpected shape at: ${where}`);
		}
		return parsed.data;
	}

	async function allPages<T extends z.ZodType>(
		path: string,
		params: Record<string, string>,
		item: T,
	): Promise<z.infer<T>[]> {
		const schema = pageSchema(item);
		const out: z.infer<T>[] = [];
		for (let page = 1; page <= MAX_PAGES; page++) {
			const res = await get(path, { ...params, page: String(page), pageSize: "500" }, schema);
			out.push(...res.results);
			if (page >= res.totalPages || res.results.length === 0) return out;
		}
		throw new PluggyError(`Pluggy GET ${path} had more than ${MAX_PAGES} pages`);
	}

	return {
		getItem: (itemId) => get(`/items/${encodeURIComponent(itemId)}`, {}, ItemSchema),

		listAccounts: (itemId) => allPages("/accounts", { itemId }, AccountSchema),

		listBills: (accountId) => allPages("/bills", { accountId }, BillSchema),

		// GET /transactions (offset pages) is retired on 2026-12-31; v2 is
		// cursor-paged. `next` is a ready query string ("?accountId=…&after=…");
		// only its `after` is taken, so our own filters ride on every page.
		async listTransactions({ accountId, from, to }) {
			const out: PluggyTransaction[] = [];
			let after: string | undefined;
			for (let page = 0; page < MAX_PAGES; page++) {
				const res = await get(
					"/v2/transactions",
					{ accountId, dateFrom: from, dateTo: to, after },
					TransactionCursorPageSchema,
				);
				out.push(...res.results);
				if (!res.next) return out;
				const nextAfter = new URL(res.next, baseUrl).searchParams.get("after");
				if (!nextAfter || nextAfter === after) return out;
				after = nextAfter;
			}
			throw new PluggyError(`Pluggy GET /v2/transactions had more than ${MAX_PAGES} pages`);
		},
	};
}
