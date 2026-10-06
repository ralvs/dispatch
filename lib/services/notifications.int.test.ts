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
	listLedger,
	listNotifications,
	markAllNotificationsRead,
	markNotification,
	recordNotification,
	recordNotificationOrThrow,
	resolveAlerts,
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

// Alerts, so every seeded row starts unread (ADR-0080).
async function seedLedger() {
	const sb = serviceClient();
	const a = await recordNotificationOrThrow(sb, {
		type: "gcal.sync_failed",
		title: "Calendar bridge failed",
	});
	const b = await recordNotificationOrThrow(sb, {
		type: "cron.sweep",
		title: "Sweep reconciled 1 stuck capture(s)",
	});
	const c = await recordNotificationOrThrow(sb, { type: "push.failed", title: "Push failed" });
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
	it("records an alert unread, with omitted fields as null", async () => {
		const row = await recordNotification(serviceClient(), {
			type: "gcal.sync_failed",
			title: "Calendar bridge failed",
		});
		expect(row).toMatchObject({
			type: "gcal.sync_failed",
			title: "Calendar bridge failed",
			body: null,
			source_ref: null,
			source_url: null,
			undo_payload: null,
			status: "unread",
		});
	});

	it("records activity already read, still pushed, and out of the unread count", async () => {
		const sb = serviceClient();
		const fired = await recordNotificationOrThrow(sb, {
			type: "reminder.fired",
			title: "Standup in 10m",
		});
		const captured = await recordNotification(sb, { type: "capture.link", title: "Saved link" });
		expect(fired.status).toBe("read");
		expect(captured?.status).toBe("read");
		expect(sendNotification).toHaveBeenCalledTimes(2);
		expect(await unreadCount(await ownerClient())).toBe(0);
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

	it("the ledger view puts every unread row first, then the newest read, and drops dismissed", async () => {
		const sb = await ownerClient();
		const { a, b, c } = await seedLedger();
		const reminder = await recordNotificationOrThrow(serviceClient(), {
			type: "reminder.fired",
			title: "Standup in 10m",
		});
		await markNotification(sb, b.id, "dismissed");

		// The alerts are older than the reminder, and still lead.
		const ledger = await listLedger(sb, { limit: 1 });
		expect(ledger.map((n) => n.id)).toEqual([c.id, reminder.id]);
		const full = await listLedger(sb, { limit: 100 });
		expect(full.map((n) => n.id)).toEqual([c.id, a.id, reminder.id]);
	});

	it("resolving alerts marks only that type's unread rows read, and busts only when it did", async () => {
		const sb = serviceClient();
		const failed = await recordNotificationOrThrow(sb, {
			type: "gcal.sync_failed",
			title: "Calendar bridge failed",
		});
		const other = await recordNotificationOrThrow(sb, {
			type: "push.failed",
			title: "Push failed",
		});
		(afterExternalMutation as Mock).mockReset();

		expect(await resolveAlerts(sb, "gcal.sync_failed")).toBe(1);
		expect(afterExternalMutation).toHaveBeenCalledTimes(1);
		const rows = await listNotifications(sb);
		expect(rows.find((n) => n.id === failed.id)?.status).toBe("read");
		expect(rows.find((n) => n.id === other.id)?.status).toBe("unread");

		(afterExternalMutation as Mock).mockReset();
		expect(await resolveAlerts(sb, "gcal.sync_failed")).toBe(0);
		expect(afterExternalMutation).not.toHaveBeenCalled();
	});

	it("resolving alerts resolves 0, logged, when the database is unreachable", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			expect(await resolveAlerts(unreachableClient(), "gcal.sync_failed")).toBe(0);
			expect(error).toHaveBeenCalled();
		} finally {
			error.mockRestore();
		}
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
