import { describe, expect, it, vi } from "vitest";
import type { IntentCtx } from "@/lib/store/types";
import { markAllNotificationsAction, markNotificationAction } from "./actions";
import { notificationWrites } from "./writes";

vi.mock("./actions", () => ({
	markAllNotificationsAction: vi.fn(),
	markNotificationAction: vi.fn(),
}));

const ctx: IntentCtx = {
	todayIso: "2026-07-15",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

describe("notificationWrites", () => {
	it("one mark: the intent and the call name the same row and status", async () => {
		const w = notificationWrites.mark("n1", "read");
		expect(w.intent).toEqual({ type: "mark", id: "n1", status: "read" });
		await w.call(ctx);
		expect(markNotificationAction).toHaveBeenCalledWith("n1", "read");
	});

	it("mark all sends the same status", async () => {
		const w = notificationWrites.markAll("dismissed");
		expect(w.intent).toEqual({ type: "markAll", status: "dismissed" });
		await w.call(ctx);
		expect(markAllNotificationsAction).toHaveBeenCalledWith("dismissed");
	});
});
