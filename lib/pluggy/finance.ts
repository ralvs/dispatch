import { shiftDay, todayInTz } from "@/lib/dates";
import type { PluggyClient } from "./client";
import type { ItemRef } from "./config";
import { checkConsent } from "./consent";
import { brlAmount, localDay, maskNumber } from "./format";
import type { PluggyAccount, PluggyItem, PluggyTransaction } from "./schemas";
import { type GroupBy, summarize } from "./summary";

// ─────────────────────────────────────────────────────────────────────────
// The read-only finance tools behind /api/mcp (docs/adr/0096), as plain
// functions so scripts/pluggy-smoke.ts calls exactly what the tools call.
// Every value here is the owner's own Nubank data through Meu Pluggy, which
// syncs once a day: data is up to about a day old, and the tools say so.
//
// Dates cross this boundary as YYYY-MM-DD in the app timezone (iron rule
// #1). Pluggy is asked for one day more on each side, then rows are kept by
// their local day, so a late-evening purchase lands on the day it was made.
// ─────────────────────────────────────────────────────────────────────────

export type FinanceContext = {
	client: PluggyClient;
	items: ItemRef[];
	tz: string;
	nowMs: number;
};

export const FRESHNESS_NOTE =
	"Meu Pluggy syncs each bank once every 24 hours and Open Finance transactions can take up to 24 hours more to appear, so this data is up to about a day old.";

export const DEFAULT_RANGE_DAYS = 30;

export class FinanceInputError extends Error {
	override name = "FinanceInputError";
}

type LabeledAccount = { label: string; account: PluggyAccount };

async function loadItems(ctx: FinanceContext): Promise<{ ref: ItemRef; item: PluggyItem }[]> {
	return Promise.all(
		ctx.items.map(async (ref) => ({ ref, item: await ctx.client.getItem(ref.itemId) })),
	);
}

async function loadAccounts(ctx: FinanceContext): Promise<LabeledAccount[]> {
	const perItem = await Promise.all(
		ctx.items.map(async (ref) =>
			(await ctx.client.listAccounts(ref.itemId)).map((account) => ({ label: ref.label, account })),
		),
	);
	return perItem.flat();
}

function freshness(items: { ref: ItemRef; item: PluggyItem }[]) {
	return {
		note: FRESHNESS_NOTE,
		connections: items.map(({ ref, item }) => ({
			label: ref.label,
			lastUpdatedAt: item.lastUpdatedAt ?? null,
		})),
	};
}

/** Resolves an optional from/to pair to a valid local-day range. */
export function resolveRange(
	ctx: Pick<FinanceContext, "tz" | "nowMs">,
	from?: string,
	to?: string,
): { from: string; to: string } {
	const end = to ?? todayInTz(ctx.tz, ctx.nowMs);
	const start = from ?? shiftDay(end, -(DEFAULT_RANGE_DAYS - 1));
	if (start > end) throw new FinanceInputError(`from (${start}) is after to (${end}).`);
	return { from: start, to: end };
}

function pickAccounts(all: LabeledAccount[], accountId?: string): LabeledAccount[] {
	if (!accountId) return all;
	const one = all.filter((a) => a.account.id === accountId);
	if (one.length === 0) {
		throw new FinanceInputError("No account with that id. Use finance_list_accounts for ids.");
	}
	return one;
}

async function transactionsIn(
	ctx: FinanceContext,
	accounts: LabeledAccount[],
	range: { from: string; to: string },
): Promise<{ account: LabeledAccount; tx: PluggyTransaction }[]> {
	const perAccount = await Promise.all(
		accounts.map(async (account) => {
			const rows = await ctx.client.listTransactions({
				accountId: account.account.id,
				from: shiftDay(range.from, -1),
				to: shiftDay(range.to, 1),
			});
			return rows
				.filter((tx) => {
					const day = localDay(tx.date, ctx.tz);
					return day >= range.from && day <= range.to;
				})
				.map((tx) => ({ account, tx }));
		}),
	);
	return perAccount.flat();
}

// ── connection_status ───────────────────────────────────────────────────

export async function connectionStatus(ctx: FinanceContext) {
	const connections = await Promise.all(
		ctx.items.map(async (ref) => {
			const [item, accounts] = await Promise.all([
				ctx.client.getItem(ref.itemId),
				ctx.client.listAccounts(ref.itemId),
			]);
			const consent = checkConsent(item, accounts.length, ctx.nowMs);
			return {
				label: ref.label,
				itemId: ref.itemId,
				connector: item.connector?.name ?? null,
				status: item.status,
				executionStatus: item.executionStatus,
				error: item.error?.code ?? null,
				lastUpdatedAt: item.lastUpdatedAt ?? null,
				nextAutoSyncAt: item.nextAutoSyncAt ?? null,
				consentExpiresAt: item.consentExpiresAt ?? null,
				consentDaysLeft: consent.daysLeft,
				accountCount: accounts.length,
				warning: consent.warning,
			};
		}),
	);
	return { note: FRESHNESS_NOTE, connections };
}

// ── list_accounts ───────────────────────────────────────────────────────

function toAccount({ label, account: a }: LabeledAccount, tz: string) {
	const credit = a.type === "CREDIT" ? a.creditData : null;
	return {
		connection: label,
		id: a.id,
		type: a.type,
		subtype: a.subtype,
		name: a.marketingName ?? a.name,
		number: maskNumber(a.number),
		balance: a.balance,
		currency: a.currencyCode,
		...(credit
			? {
					creditLimit: credit.creditLimit ?? null,
					availableCreditLimit: credit.availableCreditLimit ?? null,
					minimumPayment: credit.minimumPayment ?? null,
					dueDate: credit.balanceDueDate ? localDay(credit.balanceDueDate, tz) : null,
					closingDate: credit.balanceCloseDate ? localDay(credit.balanceCloseDate, tz) : null,
					brand: credit.brand ?? null,
				}
			: {}),
	};
}

export async function listAccounts(ctx: FinanceContext) {
	const [items, accounts] = await Promise.all([loadItems(ctx), loadAccounts(ctx)]);
	return { dataFreshness: freshness(items), accounts: accounts.map((a) => toAccount(a, ctx.tz)) };
}

// ── get_transactions ────────────────────────────────────────────────────

export type TransactionsInput = {
	accountId?: string;
	from?: string;
	to?: string;
	search?: string;
	minAmount?: number;
	maxAmount?: number;
	status?: "POSTED" | "PENDING";
	limit: number;
};

function toTransaction(tx: PluggyTransaction, account: LabeledAccount, tz: string) {
	const card = tx.creditCardMetadata;
	const installments =
		card?.totalInstallments && card.totalInstallments > 1
			? {
					number: card.installmentNumber ?? null,
					total: card.totalInstallments,
					purchaseTotal: card.totalAmount ?? null,
					purchaseDate: card.purchaseDate ? localDay(card.purchaseDate, tz) : null,
				}
			: null;
	return {
		date: localDay(tx.date, tz),
		description: tx.description,
		amount: tx.amount,
		currency: tx.currencyCode,
		...(tx.currencyCode !== account.account.currencyCode && tx.amountInAccountCurrency != null
			? { amountInAccountCurrency: tx.amountInAccountCurrency }
			: {}),
		type: tx.type ?? null,
		category: tx.category ?? null,
		status: tx.status ?? null,
		merchant: tx.merchant?.name ?? tx.merchant?.businessName ?? null,
		installments,
		card: maskNumber(card?.cardNumber),
		accountId: tx.accountId,
		account: account.account.marketingName ?? account.account.name,
	};
}

export async function getTransactions(ctx: FinanceContext, input: TransactionsInput) {
	const range = resolveRange(ctx, input.from, input.to);
	const [items, all] = await Promise.all([loadItems(ctx), loadAccounts(ctx)]);
	const accounts = pickAccounts(all, input.accountId);
	const rows = await transactionsIn(ctx, accounts, range);
	const needle = input.search?.trim().toLowerCase();

	const matched = rows
		.filter(({ tx }) => {
			const amount = brlAmount(tx);
			if (input.minAmount !== undefined && amount < input.minAmount) return false;
			if (input.maxAmount !== undefined && amount > input.maxAmount) return false;
			if (input.status && tx.status !== input.status) return false;
			if (needle) {
				const haystack = [tx.description, tx.merchant?.name, tx.merchant?.businessName, tx.category]
					.filter(Boolean)
					.join(" ")
					.toLowerCase();
				if (!haystack.includes(needle)) return false;
			}
			return true;
		})
		.sort((a, b) => b.tx.date.localeCompare(a.tx.date) || a.tx.id.localeCompare(b.tx.id));

	return {
		dataFreshness: freshness(items),
		range,
		total: matched.length,
		truncated: matched.length > input.limit,
		transactions: matched
			.slice(0, input.limit)
			.map(({ tx, account }) => toTransaction(tx, account, ctx.tz)),
	};
}

// ── get_credit_card_bills ───────────────────────────────────────────────

export type BillsInput = { accountId?: string; limit: number; includeTransactions: boolean };

export async function getCreditCardBills(ctx: FinanceContext, input: BillsInput) {
	const [items, all] = await Promise.all([loadItems(ctx), loadAccounts(ctx)]);
	const cards = pickAccounts(all, input.accountId).filter((a) => a.account.type === "CREDIT");
	if (input.accountId && cards.length === 0) {
		throw new FinanceInputError("That account is not a credit card.");
	}

	const perCard = await Promise.all(
		cards.map(async (card) => {
			const bills = (await ctx.client.listBills(card.account.id))
				.sort((a, b) => b.dueDate.localeCompare(a.dueDate))
				.slice(0, input.limit);

			let byBill = new Map<string, PluggyTransaction[]>();
			if (input.includeTransactions && bills.length > 0) {
				// One read over the whole span of the chosen bills, then grouped by
				// the billId Pluggy puts on each card transaction.
				const days = bills.flatMap((b) => [
					localDay(b.dueDate, ctx.tz),
					localDay(b.billClosingDate ?? b.dueDate, ctx.tz),
				]);
				const first = shiftDay(
					days.reduce((a, b) => (a < b ? a : b)),
					-62,
				);
				const last = shiftDay(
					days.reduce((a, b) => (a > b ? a : b)),
					1,
				);
				const txs = await ctx.client.listTransactions({
					accountId: card.account.id,
					from: first,
					to: last,
				});
				byBill = new Map();
				for (const tx of txs) {
					const billId = tx.creditCardMetadata?.billId;
					if (!billId) continue;
					byBill.set(billId, [...(byBill.get(billId) ?? []), tx]);
				}
			}

			return {
				accountId: card.account.id,
				card: card.account.marketingName ?? card.account.name,
				number: maskNumber(card.account.number),
				bills: bills.map((bill) => ({
					id: bill.id,
					dueDate: localDay(bill.dueDate, ctx.tz),
					closingDate: bill.billClosingDate ? localDay(bill.billClosingDate, ctx.tz) : null,
					total: bill.totalAmount,
					currency: bill.totalAmountCurrencyCode,
					minimumPayment: bill.minimumPaymentAmount ?? null,
					...(input.includeTransactions
						? {
								transactions: (byBill.get(bill.id) ?? [])
									.sort((a, b) => b.date.localeCompare(a.date))
									.map((tx) => toTransaction(tx, card, ctx.tz)),
							}
						: {}),
				})),
			};
		}),
	);

	return {
		dataFreshness: freshness(items),
		...(input.includeTransactions
			? {
					transactionsNote:
						"Transactions are matched to a bill by the billId Pluggy sets on each card transaction; a bill with none listed may simply not be linked by the bank.",
				}
			: {}),
		cards: perCard,
	};
}

// ── spending_summary ────────────────────────────────────────────────────

export const SPENDING_RULE =
	"Outflows and inflows are unsigned BRL. Transfers between the owner's own accounts (category 'Same person transfer…', or payer and receiver with the same document) and credit-card bill payments (category 'Credit card payment', or the card's 'Pagamento recebido' credit) are left out of the groups and totals and reported under `excluded`: each card purchase already counts once on the card, so the bill payment would count it twice. Pending and posted rows both count.";

export type SummaryInput = { from?: string; to?: string; groupBy: GroupBy; accountId?: string };

export async function spendingSummary(ctx: FinanceContext, input: SummaryInput) {
	const range = resolveRange(ctx, input.from, input.to);
	const [items, all] = await Promise.all([loadItems(ctx), loadAccounts(ctx)]);
	const accounts = pickAccounts(all, input.accountId);
	const rows = await transactionsIn(ctx, accounts, range);
	const summary = summarize(
		rows.map(({ account, tx }) => ({
			transaction: tx,
			onCreditCard: account.account.type === "CREDIT",
		})),
		input.groupBy,
		ctx.tz,
	);
	return {
		dataFreshness: freshness(items),
		range,
		groupBy: input.groupBy,
		rule: SPENDING_RULE,
		...summary,
	};
}
