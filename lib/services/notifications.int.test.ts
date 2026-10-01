import { describe, expect, it } from "vitest";
import {
	dismissAllNotifications,
	listNotifications,
	markAllNotificationsRead,
	markNotification,
	recordNotification,
	unreadCount,
} from "@/lib/services/notifications";
import { anonClient, ownerClient, serviceClient } from "@/test/integration/clients";

// The ledger against the real table (#18): what a mark changes and what it
// returns, which the entity store confirms from (#28). Cron writes through the
// service client; the page reads and marks through the owner's.

async function seedLedger() {
	const sb = serviceClient();
	const a = await recordNotification(sb, { type: "reminder.fired", title: "Standup in 10m" });
	const b = await recordNotification(sb, { type: "caldav.synced", title: "Calendar synced" });
	const c = await recordNotification(sb, { type: "capture.filed", title: "Note filed" });
	return { a, b, c };
}

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
