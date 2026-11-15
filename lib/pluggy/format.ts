import { dateOfInstant } from "@/lib/dates";
import type { PluggyTransaction } from "./schemas";

/** Last four digits only: "0001/12345-0" → "••••3450". Null in, null out. */
export function maskNumber(number: string | null | undefined): string | null {
	if (!number) return null;
	const digits = number.replace(/\D/g, "");
	if (digits.length === 0) return "••••";
	return `••••${digits.slice(-4)}`;
}

/**
 * The calendar day a Pluggy date falls on in the app timezone (iron rule #1).
 * Pluggy sends day-only values as midnight UTC ("2026-11-03T00:00:00.000Z")
 * or with no zone at all ("2026-11-20T00:00:00", bills); those are already
 * the day and must not be shifted to the evening before in São Paulo. Any
 * other instant is converted.
 */
export function localDay(value: string, tz: string): string {
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	if (/^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?(Z)?$/.test(value)) return value.slice(0, 10);
	if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return value.slice(0, 10);
	return dateOfInstant(value, tz);
}

/** The amount in the account's currency (BRL for Nubank), unsigned. */
export function brlAmount(tx: PluggyTransaction): number {
	const amount =
		tx.currencyCode !== "BRL" && tx.amountInAccountCurrency != null
			? tx.amountInAccountCurrency
			: tx.amount;
	return Math.abs(amount);
}

/**
 * Money leaving the account. `type` decides. Without it the sign decides,
 * and the sign means opposite things: a bank account books money out as a
 * negative amount, a credit card books a purchase as a positive one.
 */
export function isOutflow(tx: PluggyTransaction, onCreditCard: boolean): boolean {
	if (tx.type) return tx.type === "DEBIT";
	return onCreditCard ? tx.amount > 0 : tx.amount < 0;
}

// Eight or more digits, maybe split by "." "-" or "/": a CPF, CNPJ,
// account, card or phone number. Dates are left alone.
const LONG_NUMBER = /\d(?:[./-]?\d){7,}/g;
const DATE = /^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})$/;

/**
 * Masks long numbers inside free text to their last four digits. Banks put
 * a CPF or an account number into Pix descriptions; tool output must not
 * carry them.
 */
export function maskDigits(text: string): string {
	return text.replace(LONG_NUMBER, (match) =>
		DATE.test(match) ? match : `••••${match.replace(/\D/g, "").slice(-4)}`,
	);
}

/** Cents-exact rounding for sums of floats. */
export function round2(n: number): number {
	return Math.round(n * 100) / 100;
}
