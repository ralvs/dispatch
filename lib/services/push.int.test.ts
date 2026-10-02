import { beforeEach, describe, expect, it, vi } from "vitest";

// The push service is the external edge: web-push is faked, the database is not.
const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }));
vi.mock("web-push", () => ({
	default: { setVapidDetails: vi.fn(), sendNotification },
}));

const { pushConfigured } = vi.hoisted(() => ({ pushConfigured: { value: true } }));
vi.mock("@/lib/env", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/env")>();
	return {
		...actual,
		env: () => ({
			...actual.env(),
			NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
			VAPID_PRIVATE_KEY: "private-key",
		}),
		isPushConfigured: () => pushConfigured.value,
	};
});

import { deletePushSubscription, savePushSubscription, sendPushToAll } from "@/lib/services/push";
import { ownerClient, serviceClient } from "@/test/integration/clients";

// push_subscriptions against the real table (#18). RLS is on with no policy,
// so only the service client — what app/api/push/route.ts hands in — reaches it.

const KEYS = { p256dh: "p", auth: "a" };

async function endpoints() {
	const { data, error } = await serviceClient()
		.from("push_subscriptions")
		.select("endpoint, keys")
		.order("endpoint");
	if (error) throw error;
	return data;
}

beforeEach(() => {
	sendNotification.mockReset();
	pushConfigured.value = true;
});

describe("push subscriptions against the local database", () => {
	it("upserts on endpoint, so re-subscribing updates the keys", async () => {
		const sb = serviceClient();
		await savePushSubscription(sb, { endpoint: "https://push.example/1", keys: KEYS });
		await savePushSubscription(sb, {
			endpoint: "https://push.example/1",
			keys: { p256dh: "p2", auth: "a2" },
		});

		expect(await endpoints()).toEqual([
			{ endpoint: "https://push.example/1", keys: { p256dh: "p2", auth: "a2" } },
		]);
	});

	it("deletes by endpoint", async () => {
		const sb = serviceClient();
		await savePushSubscription(sb, { endpoint: "https://push.example/1", keys: KEYS });
		await savePushSubscription(sb, { endpoint: "https://push.example/2", keys: KEYS });

		await deletePushSubscription(sb, "https://push.example/1");

		expect((await endpoints()).map((r) => r.endpoint)).toEqual(["https://push.example/2"]);
	});

	it("keeps the owner's session out of the table", async () => {
		await expect(
			savePushSubscription(await ownerClient(), { endpoint: "https://push.example/1", keys: KEYS }),
		).rejects.toThrow();
		expect(await endpoints()).toEqual([]);
	});
});

describe("sendPushToAll against the local database", () => {
	it("sends to every subscription, prunes the gone ones, keeps the rest", async () => {
		const sb = serviceClient();
		for (const name of ["alive", "broken", "gone-404", "gone-410"]) {
			await savePushSubscription(sb, { endpoint: `https://push.example/${name}`, keys: KEYS });
		}
		sendNotification.mockImplementation(async ({ endpoint }: { endpoint: string }) => {
			if (endpoint.endsWith("gone-404"))
				throw Object.assign(new Error("Not Found"), { statusCode: 404 });
			if (endpoint.endsWith("gone-410"))
				throw Object.assign(new Error("Gone"), { statusCode: 410 });
			if (endpoint.endsWith("broken"))
				throw Object.assign(new Error("Server"), { statusCode: 500 });
		});

		expect(await sendPushToAll(sb, { title: "Hi", body: "there" })).toEqual({ sent: 1, pruned: 2 });
		expect(sendNotification).toHaveBeenCalledTimes(4);
		expect(sendNotification).toHaveBeenCalledWith(
			{ endpoint: "https://push.example/alive", keys: KEYS },
			JSON.stringify({ title: "Hi", body: "there" }),
		);
		expect((await endpoints()).map((r) => r.endpoint)).toEqual([
			"https://push.example/alive",
			"https://push.example/broken",
		]);
	});

	it("does nothing when push is not configured", async () => {
		const sb = serviceClient();
		await savePushSubscription(sb, { endpoint: "https://push.example/1", keys: KEYS });
		pushConfigured.value = false;

		expect(await sendPushToAll(sb, { title: "Hi" })).toEqual({ sent: 0, pruned: 0 });
		expect(sendNotification).not.toHaveBeenCalled();
	});

	it("does nothing when there are no subscriptions", async () => {
		expect(await sendPushToAll(serviceClient(), { title: "Hi" })).toEqual({ sent: 0, pruned: 0 });
		expect(sendNotification).not.toHaveBeenCalled();
	});
});
