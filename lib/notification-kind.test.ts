import { describe, expect, it } from "vitest";
import { notificationKind } from "@/lib/notification-kind";

describe("notificationKind", () => {
	it.each(["gcal.sync_failed", "push.failed", "cron.sweep"])("%s is an alert", (type) => {
		expect(notificationKind(type)).toBe("alert");
	});

	it.each([
		"capture.text",
		"capture.link",
		"capture.event",
		"capture.filed",
		"reminder.fired",
		"caldav.synced",
		"cron.observations",
		"mcp.task.created",
		"import.mem",
		"something.new",
	])("%s is activity", (type) => {
		expect(notificationKind(type)).toBe("activity");
	});
});
