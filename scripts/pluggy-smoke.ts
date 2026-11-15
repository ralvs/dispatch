/**
 * Pluggy smoke test — calls each finance tool once against the real API and
 * prints a short, masked summary (docs/adr/0096). Read-only: Pluggy is only
 * asked for GET reads, and nothing is written anywhere.
 *
 * Needs PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET and PLUGGY_ITEM_IDS:
 *   set -a && . ./.env.local && set +a && bun run smoke:pluggy
 *
 * It uses DEFAULT_TIMEZONE instead of app_settings, so it needs no Supabase.
 * It prints counts, totals and masked numbers, never descriptions or ids.
 */

import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { isPluggyConfigured } from "@/lib/env";
import { pluggyClient, pluggyItems } from "@/lib/pluggy/config";
import {
	connectionStatus,
	type FinanceContext,
	getCreditCardBills,
	getTransactions,
	listAccounts,
	spendingSummary,
} from "@/lib/pluggy/finance";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function main(): Promise<void> {
	if (!isPluggyConfigured()) {
		console.error("Set PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET and PLUGGY_ITEM_IDS first.");
		process.exit(1);
	}
	const ctx: FinanceContext = {
		client: pluggyClient(),
		items: pluggyItems(),
		tz: DEFAULT_TIMEZONE,
		nowMs: Date.now(),
	};

	console.log("\n1. finance_connection_status");
	for (const c of (await connectionStatus(ctx)).connections) {
		console.log(
			`   ${c.label}: ${c.status} (${c.executionStatus}), last sync ${c.lastUpdatedAt ?? "—"}, consent ${c.consentDaysLeft ?? "?"} days left, ${c.accountCount} accounts`,
		);
		if (c.warning) console.log(`   ⚠ ${c.warning}`);
	}

	console.log("\n2. finance_list_accounts");
	for (const a of (await listAccounts(ctx)).accounts) {
		const card =
			"creditLimit" in a && a.creditLimit != null
				? `, limit ${brl(a.creditLimit)}, due ${a.dueDate ?? "—"}`
				: "";
		console.log(`   ${a.type} ${a.name} ${a.number ?? ""}: ${brl(a.balance)}${card}`);
	}

	console.log("\n3. finance_get_transactions (last 30 days)");
	const tx = await getTransactions(ctx, { limit: 1000 });
	console.log(`   ${tx.range.from} → ${tx.range.to}: ${tx.total} transactions`);
	const perAccount = new Map<string, number>();
	for (const t of tx.transactions) perAccount.set(t.account, (perAccount.get(t.account) ?? 0) + 1);
	for (const [account, n] of perAccount) console.log(`   ${account}: ${n}`);

	console.log("\n4. finance_get_credit_card_bills");
	for (const card of (await getCreditCardBills(ctx, { limit: 3, includeTransactions: true }))
		.cards) {
		for (const b of card.bills) {
			console.log(
				`   ${card.card} ${card.number ?? ""}: due ${b.dueDate}, ${brl(b.total)}, ${b.transactions?.length ?? 0} linked transactions`,
			);
		}
	}

	console.log("\n5. finance_spending_summary (by month)");
	const s = await spendingSummary(ctx, { groupBy: "month" });
	for (const g of s.groups) console.log(`   ${g.key}: out ${brl(g.outflow)}, in ${brl(g.inflow)}`);
	console.log(
		`   excluded: ${s.excluded.own_transfer.count} own transfers, ${s.excluded.card_bill_payment.count} bill payments`,
	);
	console.log("\nOK");
}

main().catch((err: unknown) => {
	// The client's errors carry method, path and status only.
	console.error(`Smoke test failed: ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
});
