import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────
// The parts of Pluggy's responses Dispatch reads (docs/adr/0096). Shapes are
// from Pluggy's OpenAPI spec (https://api.pluggy.ai/oas3.json). zod strips
// every key not named here, so fields that carry personal data we never show
// (paymentData with CPFs and account numbers, taxNumber, owner) are dropped
// at the edge and can never leak into a tool result or a log.
// ─────────────────────────────────────────────────────────────────────────

export const AuthResponseSchema = z.object({ apiKey: z.string().min(1) });

export const ItemSchema = z.object({
	id: z.string(),
	status: z.string(),
	executionStatus: z.string(),
	lastUpdatedAt: z.string().nullish(),
	nextAutoSyncAt: z.string().nullish(),
	consentExpiresAt: z.string().nullish(),
	error: z.object({ code: z.string(), message: z.string() }).nullish(),
	connector: z.object({ id: z.number(), name: z.string().nullish() }).nullish(),
});
export type PluggyItem = z.infer<typeof ItemSchema>;

const CreditDataSchema = z.object({
	level: z.string().nullish(),
	brand: z.string().nullish(),
	balanceCloseDate: z.string().nullish(),
	balanceDueDate: z.string().nullish(),
	availableCreditLimit: z.number().nullish(),
	minimumPayment: z.number().nullish(),
	creditLimit: z.number().nullish(),
	status: z.string().nullish(),
});

export const AccountSchema = z.object({
	id: z.string(),
	type: z.enum(["BANK", "CREDIT"]),
	subtype: z.string(),
	number: z.string().nullish(),
	name: z.string(),
	marketingName: z.string().nullish(),
	balance: z.number(),
	itemId: z.string(),
	currencyCode: z.string(),
	creditData: CreditDataSchema.nullish(),
});
export type PluggyAccount = z.infer<typeof AccountSchema>;

export const TransactionSchema = z.object({
	id: z.string(),
	description: z.string(),
	currencyCode: z.string(),
	amount: z.number(),
	amountInAccountCurrency: z.number().nullish(),
	date: z.string(),
	type: z.enum(["DEBIT", "CREDIT"]).nullish(),
	status: z.enum(["POSTED", "PENDING"]).nullish(),
	category: z.string().nullish(),
	categoryId: z.string().nullish(),
	operationType: z.string().nullish(),
	accountId: z.string(),
	merchant: z.object({ name: z.string().nullish(), businessName: z.string().nullish() }).nullish(),
	creditCardMetadata: z
		.object({
			installmentNumber: z.number().nullish(),
			totalInstallments: z.number().nullish(),
			totalAmount: z.number().nullish(),
			purchaseDate: z.string().nullish(),
			cardNumber: z.string().nullish(),
			billId: z.string().nullish(),
		})
		.nullish(),
	// Read only to tell a transfer between the owner's own accounts (same
	// document on both ends, docs/adr/0096); the document never leaves
	// lib/pluggy/summary.ts.
	paymentData: z
		.object({
			payer: z
				.object({ documentNumber: z.object({ value: z.string().nullish() }).nullish() })
				.nullish(),
			receiver: z
				.object({ documentNumber: z.object({ value: z.string().nullish() }).nullish() })
				.nullish(),
		})
		.nullish(),
});
export type PluggyTransaction = z.infer<typeof TransactionSchema>;

export const BillSchema = z.object({
	id: z.string(),
	dueDate: z.string(),
	billClosingDate: z.string().nullish(),
	totalAmount: z.number(),
	totalAmountCurrencyCode: z.string(),
	minimumPaymentAmount: z.number().nullish(),
	allowsInstallments: z.boolean().nullish(),
});
export type PluggyBill = z.infer<typeof BillSchema>;

/** Offset pages: /accounts and /bills. */
export function pageSchema<T extends z.ZodType>(item: T) {
	return z.object({ page: z.number(), totalPages: z.number(), results: z.array(item) });
}

/** Cursor pages: /v2/transactions. `next` is a query string, or null on the last page. */
export const TransactionCursorPageSchema = z.object({
	results: z.array(TransactionSchema),
	next: z.string().nullish(),
});
