import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendNotificationMock, setVapidDetailsMock } = vi.hoisted(() => ({
	sendNotificationMock: vi.fn(),
	setVapidDetailsMock: vi.fn(),
}));

vi.mock("web-push", () => ({
	default: {
		setVapidDetails: setVapidDetailsMock,
		sendNotification: sendNotificationMock,
	},
}));

vi.mock("@/lib/env", () => ({
	env: () => ({
		NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
		VAPID_PRIVATE_KEY: "private-key",
		VAPID_SUBJECT: "mailto:renan@alves.id",
	}),
	isPushConfigured: vi.fn(() => true),
}));

import { isPushConfigured } from "@/lib/env";
import { deletePushSubscription, savePushSubscription, sendPushToAll } from "@/lib/services/push";

function stubSupabase(rows: Array<{ id: string; endpoint: string; keys: unknown }>) {
	const deletedEndpoints: string[] = [];
	const upserts: Array<Record<string, unknown>> = [];

	const sb = {
		from: vi.fn(() => ({
			select: vi.fn(async () => ({ data: rows, error: null })),
			upsert: vi.fn((row: Record<string, unknown>) => {
				upserts.push(row);
				return Promise.resolve({ data: null, error: null });
			}),
			delete: vi.fn(() => ({
				eq: vi.fn(async (_col: string, value: string) => {
					deletedEndpoints.push(value);
					return { data: null, error: null };
				}),
			})),
		})),
	} as unknown as SupabaseClient;

	return { sb, deletedEndpoints, upserts };
}

beforeEach(() => {
	sendNotificationMock.mockReset();
	setVapidDetailsMock.mockReset();
	vi.mocked(isPushConfigured).mockReturnValue(true);
});

describe("savePushSubscription", () => {
	it("upserts on endpoint", async () => {
		const { sb, upserts } = stubSupabase([]);

		await savePushSubscription(sb, {
			endpoint: "https://push.example/1",
			keys: { p256dh: "p", auth: "a" },
		});

		expect(upserts[0]).toMatchObject({ endpoint: "https://push.example/1" });
	});
});

describe("deletePushSubscription", () => {
	it("deletes by endpoint", async () => {
		const { sb, deletedEndpoints } = stubSupabase([]);

		await deletePushSubscription(sb, "https://push.example/1");

		expect(deletedEndpoints).toEqual(["https://push.example/1"]);
	});
});

describe("sendPushToAll", () => {
	it("no-ops when push is not configured", async () => {
		vi.mocked(isPushConfigured).mockReturnValue(false);
		const { sb } = stubSupabase([
			{ id: "1", endpoint: "https://push.example/1", keys: { p256dh: "p", auth: "a" } },
		]);

		const result = await sendPushToAll(sb, { title: "Hi" });

		expect(result).toEqual({ sent: 0, pruned: 0 });
		expect(sendNotificationMock).not.toHaveBeenCalled();
	});

	it("counts a successful send", async () => {
		sendNotificationMock.mockResolvedValueOnce(undefined);
		const { sb } = stubSupabase([
			{ id: "1", endpoint: "https://push.example/1", keys: { p256dh: "p", auth: "a" } },
		]);

		const result = await sendPushToAll(sb, { title: "Hi", body: "there" });

		expect(result).toEqual({ sent: 1, pruned: 0 });
		expect(sendNotificationMock).toHaveBeenCalledTimes(1);
	});

	it("prunes subscriptions that 410 gone", async () => {
		const goneError = Object.assign(new Error("Gone"), { statusCode: 410 });
		sendNotificationMock.mockRejectedValueOnce(goneError);
		const { sb, deletedEndpoints } = stubSupabase([
			{ id: "1", endpoint: "https://push.example/dead", keys: { p256dh: "p", auth: "a" } },
		]);

		const result = await sendPushToAll(sb, { title: "Hi" });

		expect(result).toEqual({ sent: 0, pruned: 1 });
		expect(deletedEndpoints).toEqual(["https://push.example/dead"]);
	});

	it("prunes on 404 and does not throw on other errors", async () => {
		const notFound = Object.assign(new Error("Not Found"), { statusCode: 404 });
		const serverError = Object.assign(new Error("Server Error"), { statusCode: 500 });
		sendNotificationMock.mockRejectedValueOnce(notFound).mockRejectedValueOnce(serverError);
		const { sb, deletedEndpoints } = stubSupabase([
			{ id: "1", endpoint: "https://push.example/dead-404", keys: { p256dh: "p", auth: "a" } },
			{ id: "2", endpoint: "https://push.example/broken", keys: { p256dh: "p", auth: "a" } },
		]);

		const result = await sendPushToAll(sb, { title: "Hi" });

		expect(result).toEqual({ sent: 0, pruned: 1 });
		expect(deletedEndpoints).toEqual(["https://push.example/dead-404"]);
	});
});
