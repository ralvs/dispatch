import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

// The push service is the external edge: web-push is faked, the database is not.
const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }));
vi.mock("web-push", () => ({
	default: { setVapidDetails: vi.fn(), sendNotification },
}));
vi.mock("@/lib/env", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/env")>();
	return {
		...actual,
		env: () => ({
			...actual.env(),
			NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
			VAPID_PRIVATE_KEY: "private-key",
		}),
		isPushConfigured: () => true,
	};
});
// Cache invalidation needs a Next request scope; there is none in a test.
vi.mock("@/lib/invalidate", async (original) => ({
	...(await original<typeof import("@/lib/invalidate")>()),
	afterExternalMutation: vi.fn(),
}));

import { afterExternalMutation } from "@/lib/invalidate";
import {
	dismissAllNotifications,
	listNotifications,
	markAllNotificationsRead,
	markNotification,
	recordNotification,
	recordNotificationOrThrow,
	unreadCount,
} from "@/lib/services/notifications";
import { savePushSubscription } from "@/lib/services/push";
import {
	anonClient,
	ownerClient,
	serviceClient,
	unreachableClient,
} from "@/test/integration/clients";

// The ledger against the real table (#18): what a mark changes and what it
// returns, which the entity store confirms from (#28). Cron writes through the
// service client; the page reads and marks through the owner's.

async function seedLedger() {
	const sb = serviceClient();
	const a = await recordNotificationOrThrow(sb, {
		type: "reminder.fired",
		title: "Standup in 10m",
	});
	const b = await recordNotificationOrThrow(sb, {
		type: "caldav.synced",
		title: "Calendar synced",
	});
	const c = await recordNotificationOrThrow(sb, { type: "capture.filed", title: "Note filed" });
	return { a, b, c };
}

const ENTRY = {
	type: "capture.filed",
	title: "Event booked",
	body: "Dentist, Tuesday 10:00",
	source_url: "/today",
};

async function ledgerRows() {
	const { data, error } = await serviceClient().from("notifications").select("id");
	if (error) throw error;
	return data;
}

beforeEach(async () => {
	sendNotification.mockReset();
	(afterExternalMutation as Mock).mockReset();
	await savePushSubscription(serviceClient(), {
		endpoint: "https://push.example/1",
		keys: { p256dh: "p", auth: "a" },
	});
});

function pushedPayloads() {
	return sendNotification.mock.calls.map((call) => JSON.parse(call[1] as string));
}

describe("the ledger announces what it records (ADR-0075)", () => {
	it("pushes a row recorded through the owner's RLS client", async () => {
		const row = await recordNotification(await ownerClient(), ENTRY);
		expect(row).toMatchObject({ type: "capture.filed", title: "Event booked" });
		expect(sendNotification).toHaveBeenCalledTimes(1);
		expect(pushedPayloads()).toEqual([
			{ title: "Event booked", body: "Dentist, Tuesday 10:00", url: "/today" },
		]);
	});

	it("pushes a row recorded through the service client", async () => {
		await recordNotification(serviceClient(), ENTRY);
		expect(sendNotification).toHaveBeenCalledTimes(1);
	});

	it("busts the ledger's tags", async () => {
		await recordNotification(serviceClient(), ENTRY);
		expect(afterExternalMutation).toHaveBeenCalledWith("notification.write");
	});

	it("resolves null, logged, with no push or bust, when the row does not land", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			expect(await recordNotification(unreachableClient(), ENTRY)).toBeNull();
			expect(error).toHaveBeenCalled();
		} finally {
			error.mockRestore();
		}
		expect(sendNotification).not.toHaveBeenCalled();
		expect(afterExternalMutation).not.toHaveBeenCalled();
	});

	it("OrThrow rejects, with no push or bust, when the row does not land", async () => {
		await expect(recordNotificationOrThrow(unreachableClient(), ENTRY)).rejects.toThrow();
		expect(sendNotification).not.toHaveBeenCalled();
		expect(afterExternalMutation).not.toHaveBeenCalled();
	});

	it("still resolves the row when push or the bust fails", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			sendNotification.mockRejectedValueOnce(Object.assign(new Error("boom"), { statusCode: 500 }));
			(afterExternalMutation as Mock).mockImplementationOnce(() => {
				throw new Error("no request scope");
			});
			const row = await recordNotification(serviceClient(), ENTRY);
			expect(row).toMatchObject({ title: "Event booked" });
			const strict = await recordNotificationOrThrow(serviceClient(), ENTRY);
			expect(strict).toMatchObject({ title: "Event booked" });
		} finally {
			error.mockRestore();
		}
		expect(await ledgerRows()).toHaveLength(2);
	});
});

describe("notifications against the local database", () => {
	it("records an unread row with omitted fields as null", async () => {
		const row = await recordNotification(serviceClient(), {
			type: "reminder.fired",
			title: "Standup in 10m",
		});
		expect(row).toMatchObject({
			type: "reminder.fired",
			title: "Standup in 10m",
			body: null,
			source_ref: null,
			source_url: null,
			undo_payload: null,
			status: "unread",
		});
	});

	it("lists newest first, filters by status and limits", async () => {
		const sb = await ownerClient();
		const { a, b, c } = await seedLedger();
		await markNotification(sb, b.id, "read");

		const all = await listNotifications(sb);
		expect(all.map((n) => n.id)).toEqual([c.id, b.id, a.id]);
		const unread = await listNotifications(sb, { status: "unread", limit: 1 });
		expect(unread.map((n) => n.id)).toEqual([c.id]);
		expect(await unreadCount(sb)).toBe(2);
	});

	it("marks one row and returns it as it now stands", async () => {
		const sb = await ownerClient();
		const { a } = await seedLedger();

		const read = await markNotification(sb, a.id, "read");
		expect(read).toMatchObject({ id: a.id, status: "read" });
		const dismissed = await markNotification(sb, a.id, "dismissed");
		expect(dismissed).toMatchObject({ id: a.id, status: "dismissed" });
	});

	it("returns null for a row that is gone", async () => {
		const sb = await ownerClient();
		const { a } = await seedLedger();
		await serviceClient().from("notifications").delete().eq("id", a.id);
		expect(await markNotification(sb, a.id, "read")).toBeNull();
	});

	it("mark all read touches only unread rows and returns them", async () => {
		const sb = await ownerClient();
		const { a, b, c } = await seedLedger();
		await markNotification(sb, a.id, "dismissed");
		await markNotification(sb, b.id, "read");

		const rows = await markAllNotificationsRead(sb);
		expect(rows.map((n) => [n.id, n.status])).toEqual([[c.id, "read"]]);
		// A dismissed row is never resurrected into read.
		const after = await listNotifications(sb);
		expect(after.find((n) => n.id === a.id)?.status).toBe("dismissed");
		expect(await unreadCount(sb)).toBe(0);
	});

	it("dismiss all takes everything still visible and returns the ids", async () => {
		const sb = await ownerClient();
		const { a, b, c } = await seedLedger();
		await markNotification(sb, a.id, "dismissed");
		await markNotification(sb, b.id, "read");

		const ids = await dismissAllNotifications(sb);
		expect(ids.sort()).toEqual([b.id, c.id].sort());
		const after = await listNotifications(sb);
		expect(after.every((n) => n.status === "dismissed")).toBe(true);
	});

	it("RLS closes the ledger to a client with no session", async () => {
		await seedLedger();
		expect(await listNotifications(anonClient())).toEqual([]);
		expect(await markAllNotificationsRead(anonClient())).toEqual([]);
	});
});
