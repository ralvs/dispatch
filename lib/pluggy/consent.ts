import { DateTime } from "luxon";
import type { PluggyItem } from "./schemas";

// The MeuPluggy authorization lasts one year (docs/adr/0096). After it
// lapses, reads come back empty and the item may still say UPDATED until its
// next sync fails with USER_AUTHORIZATION_EXPIRED. So the warning reads the
// expiry date, the error code, and whether the accounts list came back empty.

export const CONSENT_WARNING_DAYS = 30;
const RENEW =
	"Renew it: Pluggy Dashboard → your application → Demo → Connect Account → MeuPluggy, then check the itemId in PLUGGY_ITEM_IDS.";

export type ConsentCheck = { daysLeft: number | null; warning: string | null };

export function checkConsent(
	item: Pick<PluggyItem, "status" | "consentExpiresAt" | "error">,
	accountCount: number | null,
	nowMs: number,
): ConsentCheck {
	const expires = item.consentExpiresAt ? DateTime.fromISO(item.consentExpiresAt) : null;
	const daysLeft =
		expires?.isValid === true
			? Math.floor(expires.diff(DateTime.fromMillis(nowMs), "days").days)
			: null;
	const lapsed = item.error?.code === "USER_AUTHORIZATION_EXPIRED" || (daysLeft ?? 0) < 0;

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
			warning: `The MeuPluggy authorization expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. ${RENEW}`,
		};
	}
	return { daysLeft, warning: null };
}
