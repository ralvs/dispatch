import { describe, expect, it } from "vitest";
import { todayInTz } from "@/lib/dates";
import { ServiceError } from "@/lib/services/errors";
import {
	getAppTimezone,
	getReminderSettings,
	todayForRequest,
	updateAppTimezone,
	updateReminderSettings,
} from "@/lib/services/settings";
import { ownerClient, serviceClient } from "@/test/integration/clients";

// The app_settings singleton against the real table (#18). Pages read it
// through the owner's client; the crons read it through the service client.

describe("settings against the local database", () => {
	it("reads the seeded timezone under both clients", async () => {
		expect(await getAppTimezone(await ownerClient())).toBe("America/Sao_Paulo");
		expect(await getAppTimezone(serviceClient())).toBe("America/Sao_Paulo");
		expect(await todayForRequest(await ownerClient())).toBe(todayInTz("America/Sao_Paulo"));
	});

	it("stores a valid timezone", async () => {
		await updateAppTimezone(await ownerClient(), "Europe/Lisbon");

		expect(await getAppTimezone(serviceClient())).toBe("Europe/Lisbon");
	});

	it("rejects an unknown timezone and leaves the row alone", async () => {
		const sb = await ownerClient();

		const error = await updateAppTimezone(sb, "Mars/Olympus_Mons").catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ServiceError);
		expect((error as ServiceError).code).toBe("INVALID");
		expect(await getAppTimezone(serviceClient())).toBe("America/Sao_Paulo");
	});

	it("reads the seeded reminder settings, and stores new ones", async () => {
		const sb = await ownerClient();
		expect(await getReminderSettings(sb)).toEqual({ offsetMinutes: 0, anchorTime: "09:00:00" });

		await updateReminderSettings(sb, { offsetMinutes: 30, anchorTime: "07:30" });

		expect(await getReminderSettings(serviceClient())).toEqual({
			offsetMinutes: 30,
			anchorTime: "07:30:00",
		});
	});
});
