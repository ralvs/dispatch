import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { checkConsent } from "./consent";

const TZ = "America/Sao_Paulo";
const NOW = DateTime.fromISO("2026-11-15T12:00:00Z").toMillis();
const inDays = (d: number) => DateTime.fromMillis(NOW).toUTC().plus({ days: d }).toISO();

describe("checkConsent", () => {
	it("is quiet with more than 30 days left", () => {
		const c = checkConsent({ status: "UPDATED", consentExpiresAt: inDays(45) }, 2, NOW, TZ);
		expect(c).toEqual({ daysLeft: 45, warning: null });
	});

	it("warns inside 30 days", () => {
		const c = checkConsent(
			{ status: "UPDATED", consentExpiresAt: "2026-11-27T15:00:00.000Z" },
			2,
			NOW,
			TZ,
		);
		expect(c.daysLeft).toBe(12);
		expect(c.warning).toMatch(/expires in 12 days/);
		expect(c.warning).toMatch(/MeuPluggy/);
	});

	it("says reads are empty because the authorization lapsed", () => {
		const c = checkConsent({ status: "UPDATED", consentExpiresAt: inDays(-3) }, 0, NOW, TZ);
		expect(c.warning).toMatch(/has expired/);
		expect(c.warning).toMatch(/empty/);
	});

	it("reads USER_AUTHORIZATION_EXPIRED as lapsed even before the date", () => {
		const c = checkConsent(
			{
				status: "LOGIN_ERROR",
				consentExpiresAt: inDays(100),
				error: { code: "USER_AUTHORIZATION_EXPIRED", message: "expired" },
			},
			0,
			NOW,
			TZ,
		);
		expect(c.warning).toMatch(/has expired/);
	});

	it("flags an empty read even with consent in date", () => {
		const c = checkConsent({ status: "UPDATED", consentExpiresAt: inDays(200) }, 0, NOW, TZ);
		expect(c.warning).toMatch(/No accounts/);
	});

	it("counts calendar days in the app timezone, not 24-hour blocks", () => {
		// 23:30 on the 15th in São Paulo; it ends 09:00 on the 16th, 9.5 hours later.
		const lateEvening = DateTime.fromISO("2026-11-16T02:30:00Z").toMillis();
		const c = checkConsent(
			{ status: "UPDATED", consentExpiresAt: "2026-11-16T12:00:00.000Z" },
			2,
			lateEvening,
			TZ,
		);
		expect(c.daysLeft).toBe(1);
		expect(c.warning).toMatch(/expires in 1 day\./);
	});

	it("says today on the last day, and expired once the instant is past", () => {
		const item = { status: "UPDATED" as const, consentExpiresAt: "2026-11-15T20:00:00.000Z" };
		expect(checkConsent(item, 2, NOW, TZ).warning).toMatch(/expires today/);
		const after = DateTime.fromISO("2026-11-15T20:00:01Z").toMillis();
		expect(checkConsent(item, 2, after, TZ).warning).toMatch(/has expired/);
	});

	it("handles a missing expiry", () => {
		const c = checkConsent({ status: "UPDATED", consentExpiresAt: null }, 1, NOW, TZ);
		expect(c).toEqual({ daysLeft: null, warning: null });
	});
});
