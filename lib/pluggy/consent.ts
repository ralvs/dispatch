import { DateTime } from "luxon";
import { calendarDaysBetween, dateOfInstant, todayInTz } from "@/lib/dates";
import type { PluggyItem } from "./schemas";

// The MeuPluggy authorization lasts one year (docs/adr/0096). After it
// lapses, reads come back empty and the item may still say UPDATED until its
// next sync fails with USER_AUTHORIZATION_EXPIRED. So the warning reads the
// expiry date, the error code, and whether the accounts list came back empty.

export const CONSENT_WARNING_DAYS = 30;
const RENEW =
	"Renew it: Pluggy Dashboard → your application → Demo → Connect Account → MeuPluggy, then check the itemId in PLUGGY_ITEM_IDS.";

export type ConsentCheck = { daysLeft: number | null; warning: string | null };

/**
 * Days left are calendar days in the app timezone (iron rule #1): from
 * today to the local day the expiry instant falls on, 0 on that day. It has
 * lapsed once the instant is past. The expiry is a real instant, so it is
 * converted even at midnight UTC: the earlier day is the safe one to warn by.
 */
export function checkConsent(
	item: Pick<PluggyItem, "status" | "consentExpiresAt" | "error">,
	accountCount: number | null,
	nowMs: number,
	tz: string,
): ConsentCheck {
	const raw = item.consentExpiresAt;
	const expires = raw ? DateTime.fromISO(raw, { zone: "utc" }) : null;
	const valid = raw != null && expires?.isValid === true;
	const daysLeft = valid ? calendarDaysBetween(todayInTz(tz, nowMs), dateOfInstant(raw, tz)) : null;
	const lapsed =
		item.error?.code === "USER_AUTHORIZATION_EXPIRED" || (valid && expires.toMillis() <= nowMs);

	if (lapsed) {
		const empty = accountCount === 0 ? " Reads come back empty because of it." : "";
		return { daysLeft, warning: `The MeuPluggy authorization has expired.${empty} ${RENEW}` };
	}
	if (accountCount === 0) {
		return {
			daysLeft,
			warning: `No accounts came back for this connection; the authorization may have lapsed. ${RENEW}`,
		};
	}
	if (item.status === "LOGIN_ERROR") {
		return { daysLeft, warning: `The connection is in LOGIN_ERROR. ${RENEW}` };
	}
	if (daysLeft !== null && daysLeft < CONSENT_WARNING_DAYS) {
		return {
			daysLeft,
			warning: `The MeuPluggy authorization expires ${daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}. ${RENEW}`,
		};
	}
	return { daysLeft, warning: null };
}
