import { brlAmount, isOutflow, localDay, maskDigits, round2 } from "./format";
import type { PluggyTransaction } from "./schemas";

// ─────────────────────────────────────────────────────────────────────────
// spending_summary's rules (docs/adr/0096). Money that only moves between
// the owner's own pockets is not spending, and counting it would count the
// same real-money out twice:
//
//   1. A transfer between the owner's own accounts — Pluggy category
//      "Same person transfer…", or a payment whose payer and receiver carry
//      the same document number.
//   2. A credit-card bill payment — category "Credit card payment", or, on
//      the card itself, the credit Nubank books as "Pagamento recebido".
//      Each card purchase already counts as an outflow on the card; paying
//      the bill from checking would count it a second time.
//
// Excluded rows are not dropped silently: their count and totals come back
// under `excluded`, so the reader sees what was set aside and why.
// ─────────────────────────────────────────────────────────────────────────

export type GroupBy = "category" | "merchant" | "day" | "month";

export type ExclusionReason = "own_transfer" | "card_bill_payment";

export type SummaryRow = {
	transaction: PluggyTransaction;
	/** The account the row came from is a credit card. */
	onCreditCard: boolean;
};

export function exclusionReason(row: SummaryRow): ExclusionReason | null {
	const { transaction: tx, onCreditCard } = row;
	const category = tx.category?.trim().toLowerCase() ?? "";
	if (category.startsWith("same person transfer")) return "own_transfer";
	const payer = tx.paymentData?.payer?.documentNumber?.value;
	const receiver = tx.paymentData?.receiver?.documentNumber?.value;
	if (payer && receiver && digits(payer) === digits(receiver)) return "own_transfer";
	if (category === "credit card payment") return "card_bill_payment";
	if (onCreditCard && !isOutflow(tx, true) && /pagamento recebido/i.test(tx.description)) {
		return "card_bill_payment";
	}
	return null;
}

function digits(s: string): string {
	return s.replace(/\D/g, "");
}

export function groupKey(tx: PluggyTransaction, groupBy: GroupBy, tz: string): string {
	switch (groupBy) {
		case "category":
			return tx.category?.trim() || "Uncategorized";
		case "merchant":
			return maskDigits(
				tx.merchant?.name?.trim() || tx.merchant?.businessName?.trim() || tx.description,
			);
		case "day":
			return localDay(tx.date, tz);
		case "month":
			return localDay(tx.date, tz).slice(0, 7);
	}
}

type Totals = { outflow: number; inflow: number; count: number };
export type SummaryGroup = { key: string; outflow: number; inflow: number; count: number };

export type Summary = {
	currency: "BRL";
	groups: SummaryGroup[];
	totals: { outflow: number; inflow: number; net: number; count: number };
	excluded: Record<ExclusionReason, Totals>;
};

/**
 * Sums outflows and inflows per group, unsigned BRL. Groups come back
 * largest outflow first, then by key, except day and month, which come back
 * in date order.
 */
export function summarize(rows: SummaryRow[], groupBy: GroupBy, tz: string): Summary {
	const groups = new Map<string, Totals>();
	const totals: Totals = { outflow: 0, inflow: 0, count: 0 };
	const excluded: Record<ExclusionReason, Totals> = {
		own_transfer: { outflow: 0, inflow: 0, count: 0 },
		card_bill_payment: { outflow: 0, inflow: 0, count: 0 },
	};

	for (const row of rows) {
		const tx = row.transaction;
		const amount = brlAmount(tx);
		const out = isOutflow(tx, row.onCreditCard);
		const reason = exclusionReason(row);
		let bucket: Totals;
		if (reason !== null) {
			bucket = excluded[reason];
		} else {
			const key = groupKey(tx, groupBy, tz);
			bucket = groups.get(key) ?? { outflow: 0, inflow: 0, count: 0 };
			groups.set(key, bucket);
		}
		if (out) bucket.outflow += amount;
		else bucket.inflow += amount;
		bucket.count++;
		if (reason === null) {
			if (out) totals.outflow += amount;
			else totals.inflow += amount;
			totals.count++;
		}
	}

	const chronological = groupBy === "day" || groupBy === "month";
	const list = [...groups.entries()]
		.map(([key, t]) => ({
			key,
			outflow: round2(t.outflow),
			inflow: round2(t.inflow),
			count: t.count,
		}))
		.sort((a, b) =>
			chronological
				? a.key.localeCompare(b.key)
				: b.outflow - a.outflow || a.key.localeCompare(b.key),
		);

	const roundTotals = (t: Totals): Totals => ({
		outflow: round2(t.outflow),
		inflow: round2(t.inflow),
		count: t.count,
	});
	return {
		currency: "BRL",
		groups: list,
		totals: {
			outflow: round2(totals.outflow),
			inflow: round2(totals.inflow),
			net: round2(totals.inflow - totals.outflow),
			count: totals.count,
		},
		excluded: {
			own_transfer: roundTotals(excluded.own_transfer),
			card_bill_payment: roundTotals(excluded.card_bill_payment),
		},
	};
}
