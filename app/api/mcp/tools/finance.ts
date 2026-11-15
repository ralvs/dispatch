import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { pluggyClient, pluggyItems } from "@/lib/pluggy/config";
import {
	connectionStatus,
	DEFAULT_RANGE_DAYS,
	type FinanceContext,
	FinanceInputError,
	getCreditCardBills,
	getTransactions,
	listAccounts,
	SPENDING_RULE,
	spendingSummary,
} from "@/lib/pluggy/finance";
import { getAppTimezone } from "@/lib/services/settings";
import type { SupabaseClient } from "@/lib/supabase/types";
import { registerTextTool, ToolError } from "../contract";

// The owner's Nubank checking account and credit card through Meu Pluggy,
// read-only (docs/adr/0096). Registered only when PLUGGY_* is set. No tool
// here writes, pays or moves money, and none may: the Pluggy client wraps
// only GET reads.

const STALE = "Data comes from Meu Pluggy and is up to about a day old.";
const DateSchema = z.iso.date();

export function registerFinanceTools(server: McpServer, sb: SupabaseClient): void {
	async function context(): Promise<FinanceContext> {
		return {
			client: pluggyClient(),
			items: pluggyItems(),
			tz: await getAppTimezone(sb),
			nowMs: Date.now(),
		};
	}

	/** Input mistakes read as written; anything else stays a plain error. */
	async function run<T>(fn: (ctx: FinanceContext) => Promise<T>): Promise<T> {
		try {
			return await fn(await context());
		} catch (err) {
			if (err instanceof FinanceInputError) throw new ToolError(err.message);
			throw err;
		}
	}

	const readOnly = { readOnlyHint: true, idempotentHint: true } as const;

	registerTextTool(
		server,
		"finance_connection_status",
		{
			title: "Finance connection status",
			description: `Health of each Meu Pluggy bank connection: status, last sync, next sync, when the yearly authorization expires, and a warning when it expires within 30 days or reads came back empty because it lapsed. ${STALE}`,
			inputSchema: z.object({}),
			annotations: readOnly,
		},
		() => run(connectionStatus),
	);

	registerTextTool(
		server,
		"finance_list_accounts",
		{
			title: "List bank accounts and cards",
			description: `The owner's accounts per connection: checking (BANK) and credit card (CREDIT), with balance, and for a card its limit, available limit, due date and closing date. Account numbers are masked to the last 4 digits. ${STALE}`,
			inputSchema: z.object({}),
			annotations: readOnly,
		},
		() => run(listAccounts),
	);

	registerTextTool(
		server,
		"finance_get_transactions",
		{
			title: "Get transactions",
			description: `Transactions, newest first, for one account or all of them. Dates are YYYY-MM-DD in the app timezone; the range defaults to the last ${DEFAULT_RANGE_DAYS} days. Amounts keep Pluggy's sign and currency; minAmount/maxAmount compare the unsigned BRL amount. ${STALE}`,
			inputSchema: z.object({
				accountId: z.string().optional().describe("One account id from finance_list_accounts."),
				from: DateSchema.optional().describe("First day, YYYY-MM-DD."),
				to: DateSchema.optional().describe("Last day, YYYY-MM-DD. Defaults to today."),
				search: z
					.string()
					.max(200)
					.optional()
					.describe("Text to find in the description, merchant or category."),
				minAmount: z.number().nonnegative().optional().describe("Unsigned BRL, inclusive."),
				maxAmount: z.number().nonnegative().optional().describe("Unsigned BRL, inclusive."),
				status: z.enum(["POSTED", "PENDING"]).optional(),
				limit: z.number().int().min(1).max(1000).default(200).describe("At most this many rows."),
			}),
			annotations: readOnly,
		},
		(input) => run((ctx) => getTransactions(ctx, input)),
	);

	registerTextTool(
		server,
		"finance_get_credit_card_bills",
		{
			title: "Get credit card bills",
			description: `Credit card bills, latest due date first: due date, closing date, total and minimum payment. Set includeTransactions to list the transactions Pluggy links to each bill. ${STALE}`,
			inputSchema: z.object({
				accountId: z
					.string()
					.optional()
					.describe("A CREDIT account id from finance_list_accounts. Defaults to every card."),
				limit: z.number().int().min(1).max(24).default(6).describe("The latest this many bills."),
				includeTransactions: z.boolean().default(false),
			}),
			annotations: readOnly,
		},
		(input) => run((ctx) => getCreditCardBills(ctx, input)),
	);

	registerTextTool(
		server,
		"finance_spending_summary",
		{
			title: "Spending summary",
			description: `Totals of outflows and inflows per category, merchant, day or month, computed on the server in BRL. ${SPENDING_RULE} The range defaults to the last ${DEFAULT_RANGE_DAYS} days. ${STALE}`,
			inputSchema: z.object({
				from: DateSchema.optional().describe("First day, YYYY-MM-DD."),
				to: DateSchema.optional().describe("Last day, YYYY-MM-DD. Defaults to today."),
				groupBy: z.enum(["category", "merchant", "day", "month"]).default("category"),
				accountId: z.string().optional().describe("Limit to one account id."),
			}),
			annotations: readOnly,
		},
		(input) => run((ctx) => spendingSummary(ctx, input)),
	);
}
