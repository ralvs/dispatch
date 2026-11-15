import { vi } from "vitest";

// Pluggy API fixtures and a fake fetch for lib/pluggy tests (docs/adr/0096).
// Shapes follow Pluggy's OpenAPI spec and its Sandbox connector; every value
// is invented. Never paste real Meu Pluggy data here.

export const ITEM_ID = "11111111-1111-4111-8111-111111111111";
export const CHECKING_ID = "22222222-2222-4222-8222-222222222222";
export const CARD_ID = "33333333-3333-4333-8333-333333333333";
export const BILL_ID = "44444444-4444-4444-8444-444444444444";

export function itemFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: ITEM_ID,
		status: "UPDATED",
		executionStatus: "SUCCESS",
		lastUpdatedAt: "2026-11-14T09:00:00.000Z",
		nextAutoSyncAt: "2026-11-15T09:00:00.000Z",
		consentExpiresAt: "2027-06-01T00:00:00.000Z",
		error: null,
		connector: { id: 200, name: "MeuPluggy", isSandbox: false },
		clientUserId: "sandbox-user",
		...overrides,
	};
}

export const checkingFixture = {
	id: CHECKING_ID,
	type: "BANK",
	subtype: "CHECKING_ACCOUNT",
	number: "0001/12345-0",
	name: "Conta Corrente",
	marketingName: "Nubank Conta",
	balance: 1520.33,
	itemId: ITEM_ID,
	taxNumber: "000.000.000-00",
	owner: "Sandbox Owner",
	currencyCode: "BRL",
	bankData: { transferNumber: "0001/12345-0", closingBalance: 1520.33 },
	creditData: null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-11-14T09:00:00.000Z",
};

export const cardFixture = {
	id: CARD_ID,
	type: "CREDIT",
	subtype: "CREDIT_CARD",
	number: "xxxx8670",
	name: "Nubank Mastercard",
	marketingName: "Nubank Ultravioleta",
	balance: 832.1,
	itemId: ITEM_ID,
	currencyCode: "BRL",
	bankData: null,
	creditData: {
		level: "BLACK",
		brand: "MASTERCARD",
		balanceCloseDate: "2026-11-27",
		balanceDueDate: "2026-12-04",
		availableCreditLimit: 9167.9,
		minimumPayment: 124.81,
		creditLimit: 10000,
		status: "ACTIVE",
	},
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-11-14T09:00:00.000Z",
};

let txSeq = 0;
export function txFixture(overrides: Record<string, unknown> = {}) {
	txSeq++;
	return {
		id: `aaaaaaaa-0000-4000-8000-${String(txSeq).padStart(12, "0")}`,
		description: "Padaria Central",
		descriptionRaw: null,
		currencyCode: "BRL",
		amount: -25.5,
		date: "2026-11-10T00:00:00.000Z",
		type: "DEBIT",
		balance: 1000,
		status: "POSTED",
		category: "Bakery",
		categoryId: "08010000",
		operationType: "PIX",
		accountId: CHECKING_ID,
		paymentData: null,
		createdAt: "2026-11-10T12:00:00.000Z",
		updatedAt: "2026-11-10T12:00:00.000Z",
		...overrides,
	};
}

export const billFixture = {
	id: BILL_ID,
	dueDate: "2026-11-04T00:00:00",
	billClosingDate: "2026-10-28T00:00:00",
	totalAmount: 1243.9,
	totalAmountCurrencyCode: "BRL",
	minimumPaymentAmount: 186.58,
	allowsInstallments: true,
	financeCharges: [],
	payments: [],
};

export type Route = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>;

export function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

/**
 * A fetch that answers POST /auth with a fresh key each call, and every other
 * path from `routes` (keyed by pathname). Unknown paths answer 404.
 */
export function fakePluggyFetch(routes: Record<string, Route>) {
	let keys = 0;
	return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(input instanceof Request ? input.url : input);
		if (url.pathname === "/auth" && init?.method === "POST") {
			keys++;
			return json({ apiKey: `key-${keys}` });
		}
		const route = routes[url.pathname];
		return route ? route(url, init) : json({ message: "not found" }, 404);
	});
}

/** The X-API-KEY a call carried. */
export function apiKeyOf(init: RequestInit | undefined): string | null {
	return new Headers(init?.headers).get("X-API-KEY");
}
