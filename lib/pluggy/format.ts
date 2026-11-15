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

/** Money leaving the account. `type` decides; the sign is the fallback. */
export function isOutflow(tx: PluggyTransaction): boolean {
	if (tx.type) return tx.type === "DEBIT";
	return tx.amount < 0;
}

/** Cents-exact rounding for sums of floats. */
export function round2(n: number): number {
	return Math.round(n * 100) / 100;
}
