"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import type { NotificationRow } from "@/lib/schemas/notification";
import {
	dismissAllNotifications,
	markAllNotificationsRead,
	markNotification,
} from "@/lib/services/notifications";
import { stampWrite } from "@/lib/store/server";
import type { StoreWrite } from "@/lib/store/types";

// Every action returns what it wrote (#28), so the client's entity store
// confirms its optimistic intent from it. A dismissal answers with ids only:
// a dismissed row is gone from every view (lib/store/kinds/notification.ts).

type NotificationWrite = StoreWrite<NotificationRow>;

const Status = z.enum(["read", "dismissed"]);

export async function markNotificationAction(
	id: string,
	status: "read" | "dismissed",
): Promise<ActionResult<NotificationWrite>> {
	const { sb } = await requireOwnerPage();
	const rowId = z.uuid().parse(id);
	const row = await markNotification(sb, rowId, Status.parse(status));
	afterMutation("notification.write");
	// A row that is gone, or now dismissed, leaves the store as deleted.
	if (!row || row.status === "dismissed") return { ok: true, data: stampWrite([], [rowId]) };
	return { ok: true, data: stampWrite([row]) };
}

export async function markAllNotificationsAction(
	status: "read" | "dismissed",
): Promise<ActionResult<NotificationWrite>> {
	const { sb } = await requireOwnerPage();
	if (Status.parse(status) === "read") {
		const rows = await markAllNotificationsRead(sb);
		afterMutation("notification.write");
		return { ok: true, data: stampWrite(rows) };
	}
	const ids = await dismissAllNotifications(sb);
	afterMutation("notification.write");
	return { ok: true, data: stampWrite([], ids) };
}
