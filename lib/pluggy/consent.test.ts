import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { checkConsent } from "./consent";

const NOW = DateTime.fromISO("2026-11-15T12:00:00Z").toMillis();
const inDays = (d: number) => DateTime.fromMillis(NOW).plus({ days: d }).toISO();

describe("checkConsent", () => {
	it("is quiet with more than 30 days left", () => {
		const c = checkConsent({ status: "UPDATED", consentExpiresAt: inDays(45) }, 2, NOW);
		expect(c).toEqual({ daysLeft: 45, warning: null });
	});

	it("warns inside 30 days", () => {
		const c = checkConsent({ status: "UPDATED", consentExpiresAt: inDays(12.5) }, 2, NOW);
		expect(c.daysLeft).toBe(12);
		expect(c.warning).toMatch(/expires in 12 days/);
		expect(c.warning).toMatch(/MeuPluggy/);
	});

	it("says reads are empty because the authorization lapsed", () => {
		const c = checkConsent({ status: "UPDATED", consentExpiresAt: inDays(-3) }, 0, NOW);
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
		);
		expect(c.warning).toMatch(/has expired/);
	});

	it("flags an empty read even with consent in date", () => {
		const c = checkConsent({ status: "UPDATED", consentExpiresAt: inDays(200) }, 0, NOW);
		expect(c.warning).toMatch(/No accounts/);
	});

	it("handles a missing expiry", () => {
		const c = checkConsent({ status: "UPDATED", consentExpiresAt: null }, 1, NOW);
		expect(c).toEqual({ daysLeft: null, warning: null });
	});
});
