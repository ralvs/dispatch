import { describe, expect, it } from "vitest";
import { CARD_ID, txFixture } from "@/test/fakes/pluggy";
import { TransactionSchema } from "./schemas";
import { exclusionReason, type SummaryRow, summarize } from "./summary";

const TZ = "America/Sao_Paulo";

function row(overrides: Record<string, unknown>, onCreditCard = false): SummaryRow {
	return { transaction: TransactionSchema.parse(txFixture(overrides)), onCreditCard };
}

describe("exclusionReason", () => {
	it("leaves an ordinary purchase in", () => {
		expect(exclusionReason(row({}))).toBeNull();
	});

	it("drops a same-person transfer by category", () => {
		expect(exclusionReason(row({ category: "Same person transfer - PIX" }))).toBe("own_transfer");
	});

	it("drops a transfer whose payer and receiver share a document", () => {
		const paymentData = {
			payer: { documentNumber: { type: "CPF", value: "000.000.000-00" } },
			receiver: { documentNumber: { type: "CPF", value: "00000000000" } },
		};
		expect(exclusionReason(row({ category: "Transfer - PIX", paymentData }))).toBe("own_transfer");
	});

	it("keeps a transfer to somebody else", () => {
		const paymentData = {
			payer: { documentNumber: { value: "00000000000" } },
			receiver: { documentNumber: { value: "11111111111" } },
		};
		expect(exclusionReason(row({ category: "Transfer - PIX", paymentData }))).toBeNull();
	});

	it("drops a bill payment from checking", () => {
		expect(exclusionReason(row({ category: "Credit card payment" }))).toBe("card_bill_payment");
	});

	it("drops a bill payment Pluggy filed as a transfer", () => {
		const r = row({ category: "Transfers", description: "Pagamento de fatura", amount: -500 });
		expect(exclusionReason(r)).toBe("card_bill_payment");
	});

	it("keeps money coming in that mentions a bill", () => {
		const r = row({
			category: "Transfers",
			description: "Pagamento de fatura",
			type: "CREDIT",
			amount: 500,
		});
		expect(exclusionReason(r)).toBeNull();
	});

	it("drops the payment Nubank books on the card", () => {
		const r = row(
			{ category: null, description: "Pagamento recebido", type: "CREDIT", amount: 500 },
			true,
		);
		expect(exclusionReason(r)).toBe("card_bill_payment");
	});

	it("keeps a refund on the card", () => {
		const r = row(
			{ category: "Shopping", description: "Estorno Loja", type: "CREDIT", amount: 40 },
			true,
		);
		expect(exclusionReason(r)).toBeNull();
	});
});

describe("summarize", () => {
	const rows = [
		row({ amount: -25.5, category: "Bakery", merchant: { name: "Padaria" } }),
		row({ amount: -10.25, category: "Bakery", merchant: { name: "Padaria" } }),
		row({ amount: 4500, type: "CREDIT", category: "Salary", description: "Salario" }),
		// A card purchase and the bill payment for it: the purchase counts once.
		row({ amount: 300, type: "DEBIT", category: "Shopping", accountId: CARD_ID }, true),
		row({ amount: -300, category: "Credit card payment", description: "Pagamento de fatura" }),
		row({ amount: 300, type: "CREDIT", category: null, description: "Pagamento recebido" }, true),
		row({ amount: -1000, category: "Same person transfer - PIX" }),
		// Foreign currency: the BRL amount counts.
		row({
			amount: -20,
			currencyCode: "USD",
			amountInAccountCurrency: -110.4,
			category: "Shopping",
			date: "2026-10-31T23:30:00.000Z",
		}),
	];

	it("totals by category without the double count", () => {
		const s = summarize(rows, "category", TZ);
		expect(s.groups).toEqual([
			{ key: "Shopping", outflow: 410.4, inflow: 0, count: 2 },
			{ key: "Bakery", outflow: 35.75, inflow: 0, count: 2 },
			{ key: "Salary", outflow: 0, inflow: 4500, count: 1 },
		]);
		expect(s.totals).toEqual({ outflow: 446.15, inflow: 4500, net: 4053.85, count: 5 });
		expect(s.excluded).toEqual({
			own_transfer: { outflow: 1000, inflow: 0, count: 1 },
			card_bill_payment: { outflow: 300, inflow: 300, count: 2 },
		});
	});

	it("groups by merchant, falling back to the description", () => {
		const keys = summarize(rows, "merchant", TZ).groups.map((g) => g.key);
		expect(keys).toContain("Padaria");
		expect(keys).toContain("Salario");
	});

	it("groups by local day and month in date order", () => {
		const days = summarize(rows, "day", TZ).groups.map((g) => g.key);
		// 2026-10-31T23:30Z is 20:30 on the 31st in São Paulo; midnight UTC is the day itself.
		expect(days).toEqual(["2026-10-31", "2026-11-10"]);
		const months = summarize(rows, "month", TZ).groups.map((g) => g.key);
		expect(months).toEqual(["2026-10", "2026-11"]);
	});
});
