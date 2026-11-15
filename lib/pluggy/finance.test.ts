import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
	BILL_ID,
	billFixture,
	CARD_ID,
	CHECKING_ID,
	cardFixture,
	checkingFixture,
	fakePluggyFetch,
	ITEM_ID,
	itemFixture,
	json,
	txFixture,
} from "@/test/fakes/pluggy";
import { createPluggyClient } from "./client";
import { parseItemIds } from "./config";
import {
	connectionStatus,
	type FinanceContext,
	getCreditCardBills,
	getTransactions,
	listAccounts,
	resolveRange,
	spendingSummary,
} from "./finance";
import { localDay, maskNumber } from "./format";

const TZ = "America/Sao_Paulo";
// 2026-11-15 09:00 in São Paulo.
const NOW = DateTime.fromISO("2026-11-15T12:00:00Z").toMillis();

function ctxWith(transactions: Record<string, unknown[]>, item = itemFixture()): FinanceContext {
	const fetch = fakePluggyFetch({
		[`/items/${ITEM_ID}`]: () => json(item),
		"/accounts": () =>
			json({ page: 1, total: 2, totalPages: 1, results: [checkingFixture, cardFixture] }),
		"/v2/transactions": (url) =>
			json({ results: transactions[url.searchParams.get("accountId") ?? ""] ?? [], next: null }),
		"/bills": () => json({ page: 1, total: 1, totalPages: 1, results: [billFixture] }),
	});
	return {
		client: createPluggyClient({
			clientId: "id",
			clientSecret: "secret",
			fetch: fetch as unknown as typeof globalThis.fetch,
		}),
		items: [{ label: "nubank", itemId: ITEM_ID }],
		tz: TZ,
		nowMs: NOW,
	};
}

describe("parseItemIds", () => {
	it("reads labels and bare ids", () => {
		expect(parseItemIds(`nubank:${ITEM_ID}, ${CARD_ID}`)).toEqual([
			{ label: "nubank", itemId: ITEM_ID },
			{ label: "item-2", itemId: CARD_ID },
		]);
	});

	it("refuses an id that is not a UUID", () => {
		expect(() => parseItemIds("nubank:abc-123")).toThrow(/not a UUID/);
	});
});

describe("format", () => {
	it("masks to the last four digits", () => {
		expect(maskNumber("0001/12345-0")).toBe("••••3450");
		expect(maskNumber("xxxx8670")).toBe("••••8670");
		expect(maskNumber(null)).toBeNull();
	});

	it("keeps day-only dates on their day and converts real instants", () => {
		expect(localDay("2026-11-03T00:00:00.000Z", TZ)).toBe("2026-11-03");
		expect(localDay("2026-11-20T00:00:00", TZ)).toBe("2026-11-20");
		expect(localDay("2026-11-03T01:30:00.000Z", TZ)).toBe("2026-11-02");
	});
});

describe("resolveRange", () => {
	it("defaults to the last 30 days ending today in the app timezone", () => {
		expect(resolveRange({ tz: TZ, nowMs: NOW })).toEqual({ from: "2026-10-17", to: "2026-11-15" });
	});

	it("refuses a reversed range", () => {
		expect(() => resolveRange({ tz: TZ, nowMs: NOW }, "2026-11-10", "2026-11-01")).toThrow(/after/);
	});
});

describe("connectionStatus", () => {
	it("reports the item and warns near expiry", async () => {
		const ctx = ctxWith({}, itemFixture({ consentExpiresAt: "2026-12-01T00:00:00.000Z" }));
		const { connections } = await connectionStatus(ctx);
		expect(connections[0]).toMatchObject({
			label: "nubank",
			status: "UPDATED",
			consentDaysLeft: 15,
			accountCount: 2,
		});
		expect(connections[0]?.warning).toMatch(/expires in 15 days/);
	});
});

describe("listAccounts", () => {
	it("masks numbers, drops owner data and shows card limits", async () => {
		const out = await listAccounts(ctxWith({}));
		const text = JSON.stringify(out);
		expect(text).not.toContain("12345");
		expect(text).not.toContain("000.000.000-00");
		expect(text).not.toContain("Sandbox Owner");
		expect(out.accounts[1]).toMatchObject({
			type: "CREDIT",
			number: "••••8670",
			creditLimit: 10000,
			availableCreditLimit: 9167.9,
			dueDate: "2026-12-04",
			closingDate: "2026-11-27",
		});
		expect(out.dataFreshness.connections[0]?.lastUpdatedAt).toBe("2026-11-14T09:00:00.000Z");
	});
});

describe("getTransactions", () => {
	const ctx = () =>
		ctxWith({
			[CHECKING_ID]: [
				txFixture({ description: "Mercado Bom", amount: -180, date: "2026-11-12T00:00:00.000Z" }),
				txFixture({ description: "Padaria", amount: -12, date: "2026-11-14T00:00:00.000Z" }),
				txFixture({
					description: "Old",
					amount: -50,
					date: "2026-10-01T00:00:00.000Z",
				}),
				txFixture({
					description: "Pix recebido",
					amount: 300,
					type: "CREDIT",
					status: "PENDING",
					date: "2026-11-13T00:00:00.000Z",
					paymentData: { payer: { documentNumber: { value: "00000000000" } } },
				}),
			],
			[CARD_ID]: [
				txFixture({
					accountId: CARD_ID,
					description: "Loja Parcelada",
					amount: 100,
					date: "2026-11-11T00:00:00.000Z",
					creditCardMetadata: {
						installmentNumber: 2,
						totalInstallments: 6,
						totalAmount: 600,
						purchaseDate: "2026-09-11T00:00:00.000Z",
						cardNumber: "5555666677778888",
						billId: BILL_ID,
					},
				}),
			],
		});

	it("returns the range newest first, across accounts, with freshness", async () => {
		const out = await getTransactions(ctx(), { limit: 200 });
		expect(out.range).toEqual({ from: "2026-10-17", to: "2026-11-15" });
		expect(out.transactions.map((t) => t.description)).toEqual([
			"Padaria",
			"Pix recebido",
			"Mercado Bom",
			"Loja Parcelada",
		]);
		expect(out.dataFreshness.note).toMatch(/a day old/);
	});

	it("filters by text, amount and status, and limits", async () => {
		expect(
			(await getTransactions(ctx(), { search: "mercado", limit: 200 })).transactions,
		).toHaveLength(1);
		const big = await getTransactions(ctx(), { minAmount: 100, maxAmount: 200, limit: 200 });
		expect(big.transactions.map((t) => t.description)).toEqual(["Mercado Bom", "Loja Parcelada"]);
		const pending = await getTransactions(ctx(), { status: "PENDING", limit: 200 });
		expect(pending.transactions.map((t) => t.description)).toEqual(["Pix recebido"]);
		const one = await getTransactions(ctx(), { limit: 1 });
		expect(one).toMatchObject({ total: 4, truncated: true });
	});

	it("shows installments and masks the card, never payment data", async () => {
		const out = await getTransactions(ctx(), { accountId: CARD_ID, limit: 200 });
		expect(out.transactions[0]).toMatchObject({
			installments: { number: 2, total: 6, purchaseTotal: 600, purchaseDate: "2026-09-11" },
			card: "••••8888",
		});
		const all = JSON.stringify(await getTransactions(ctx(), { limit: 200 }));
		expect(all).not.toContain("paymentData");
		expect(all).not.toContain("00000000000");
	});

	it("refuses an account that is not configured", async () => {
		await expect(getTransactions(ctx(), { accountId: "nope", limit: 10 })).rejects.toThrow(
			/No account/,
		);
	});
});

describe("getCreditCardBills", () => {
	it("lists bills and links transactions by billId", async () => {
		const ctx = ctxWith({
			[CARD_ID]: [
				txFixture({ accountId: CARD_ID, amount: 99, creditCardMetadata: { billId: BILL_ID } }),
				txFixture({ accountId: CARD_ID, amount: 1, creditCardMetadata: { billId: "other" } }),
			],
		});
		const out = await getCreditCardBills(ctx, { limit: 6, includeTransactions: true });
		expect(out.cards).toHaveLength(1);
		const bill = out.cards[0]?.bills[0];
		expect(bill).toMatchObject({
			dueDate: "2026-11-04",
			closingDate: "2026-10-28",
			total: 1243.9,
			minimumPayment: 186.58,
		});
		expect(bill?.transactions?.map((t) => t.amount)).toEqual([99]);
	});

	it("refuses a checking account", async () => {
		await expect(
			getCreditCardBills(ctxWith({}), {
				accountId: CHECKING_ID,
				limit: 6,
				includeTransactions: false,
			}),
		).rejects.toThrow(/not a credit card/);
	});
});

describe("spendingSummary", () => {
	it("leaves the bill payment out and states the rule", async () => {
		const ctx = ctxWith({
			[CHECKING_ID]: [
				txFixture({ amount: -500, category: "Credit card payment" }),
				txFixture({ amount: -40, category: "Restaurants" }),
			],
			[CARD_ID]: [
				txFixture({ accountId: CARD_ID, amount: 500, type: "DEBIT", category: "Shopping" }),
			],
		});
		const out = await spendingSummary(ctx, { groupBy: "category" });
		expect(out.totals.outflow).toBe(540);
		expect(out.excluded.card_bill_payment.outflow).toBe(500);
		expect(out.rule).toMatch(/twice/);
	});
});
