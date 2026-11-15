import { describe, expect, it } from "vitest";
import {
	apiKeyOf,
	CARD_ID,
	CHECKING_ID,
	checkingFixture,
	fakePluggyFetch,
	ITEM_ID,
	itemFixture,
	json,
	txFixture,
} from "@/test/fakes/pluggy";
import { API_KEY_TTL_MS, createPluggyClient, PluggyError } from "./client";

function setup(routes: Parameters<typeof fakePluggyFetch>[0], start = 1_000_000) {
	let now = start;
	const fetch = fakePluggyFetch(routes);
	const client = createPluggyClient({
		clientId: "client-id",
		clientSecret: "client-secret",
		fetch: fetch as unknown as typeof globalThis.fetch,
		now: () => now,
	});
	const authCalls = () => fetch.mock.calls.filter(([u]) => String(u).endsWith("/auth")).length;
	return { client, fetch, authCalls, advance: (ms: number) => (now += ms) };
}

describe("API key", () => {
	it("mints once and reuses the key until it nears expiry", async () => {
		const { client, authCalls, advance, fetch } = setup({
			[`/items/${ITEM_ID}`]: () => json(itemFixture()),
		});
		await client.getItem(ITEM_ID);
		await client.getItem(ITEM_ID);
		expect(authCalls()).toBe(1);

		advance(API_KEY_TTL_MS + 1);
		await client.getItem(ITEM_ID);
		expect(authCalls()).toBe(2);
		expect(apiKeyOf(fetch.mock.calls.at(-1)?.[1])).toBe("key-2");
	});

	it("shares one mint across parallel reads", async () => {
		const { client, authCalls } = setup({ [`/items/${ITEM_ID}`]: () => json(itemFixture()) });
		await Promise.all([client.getItem(ITEM_ID), client.getItem(ITEM_ID), client.getItem(ITEM_ID)]);
		expect(authCalls()).toBe(1);
	});

	it("mints again and retries once on a 401", async () => {
		const { client, authCalls } = setup({
			[`/items/${ITEM_ID}`]: (_url, init) =>
				apiKeyOf(init) === "key-1" ? json({ message: "expired" }, 401) : json(itemFixture()),
		});
		const item = await client.getItem(ITEM_ID);
		expect(item.status).toBe("UPDATED");
		expect(authCalls()).toBe(2);
	});

	it("gives up after the one retry", async () => {
		const { client, authCalls } = setup({
			[`/items/${ITEM_ID}`]: () => json({ message: "no" }, 401),
		});
		await expect(client.getItem(ITEM_ID)).rejects.toMatchObject({ status: 401 });
		expect(authCalls()).toBe(2);
	});

	it("sends the credentials in the body and never puts them in an error", async () => {
		const { client, fetch } = setup({ [`/items/${ITEM_ID}`]: () => json({}, 500) });
		const err = await client.getItem(ITEM_ID).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(PluggyError);
		expect(String((err as Error).message)).not.toMatch(/client-secret|key-1/);
		const authInit = fetch.mock.calls[0]?.[1];
		expect(JSON.parse(String(authInit?.body))).toEqual({
			clientId: "client-id",
			clientSecret: "client-secret",
		});
	});
});

describe("pagination", () => {
	it("reads every offset page of accounts", async () => {
		const seen: string[] = [];
		const { client } = setup({
			"/accounts": (url) => {
				const page = Number(url.searchParams.get("page"));
				seen.push(`${url.searchParams.get("itemId")}:${page}:${url.searchParams.get("pageSize")}`);
				const results =
					page === 1 ? [checkingFixture] : [{ ...checkingFixture, id: CARD_ID, name: "Two" }];
				return json({ page, total: 2, totalPages: 2, results });
			},
		});
		const accounts = await client.listAccounts(ITEM_ID);
		expect(accounts.map((a) => a.id)).toEqual([CHECKING_ID, CARD_ID]);
		expect(seen).toEqual([`${ITEM_ID}:1:500`, `${ITEM_ID}:2:500`]);
	});

	it("follows the transactions cursor until next is null, keeping the filters", async () => {
		const calls: Record<string, string | null>[] = [];
		const { client } = setup({
			"/v2/transactions": (url) => {
				const p = url.searchParams;
				calls.push({
					accountId: p.get("accountId"),
					dateFrom: p.get("dateFrom"),
					dateTo: p.get("dateTo"),
					after: p.get("after"),
				});
				if (!p.get("after")) {
					return json({
						results: [txFixture(), txFixture()],
						next: `?accountId=${CHECKING_ID}&after=cursor%2B1`,
					});
				}
				if (p.get("after") === "cursor+1") {
					return json({ results: [txFixture()], next: `?accountId=${CHECKING_ID}&after=c2` });
				}
				return json({ results: [], next: null });
			},
		});
		const rows = await client.listTransactions({
			accountId: CHECKING_ID,
			from: "2026-10-01",
			to: "2026-10-31",
		});
		expect(rows).toHaveLength(3);
		expect(calls.map((c) => c.after)).toEqual([null, "cursor+1", "c2"]);
		for (const c of calls) {
			expect(c).toMatchObject({
				accountId: CHECKING_ID,
				dateFrom: "2026-10-01",
				dateTo: "2026-10-31",
			});
		}
	});

	it("stops when the cursor repeats instead of looping", async () => {
		const { client } = setup({
			"/v2/transactions": () => json({ results: [txFixture()], next: "?after=same" }),
		});
		const rows = await client.listTransactions({ accountId: CHECKING_ID });
		expect(rows).toHaveLength(2);
	});

	it("names the path, not the data, when a response has an unexpected shape", async () => {
		const { client } = setup({
			"/v2/transactions": () => json({ results: [{ id: 1, description: "secret thing" }] }),
		});
		const err = (await client
			.listTransactions({ accountId: CHECKING_ID })
			.catch((e: unknown) => e)) as Error;
		expect(err.message).toContain("/v2/transactions");
		expect(err.message).not.toContain("secret thing");
	});
});
