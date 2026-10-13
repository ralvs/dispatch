// The notification kind's writes (docs/adr/0077): each builder makes the
// intent and its server call from the same arguments. Client-safe —
// server-action references only.

import { type Write, write } from "@/lib/store/write";
import { markAllNotificationsAction, markNotificationAction } from "./actions";

type Mark = "read" | "dismissed";

export const notificationWrites = {
	mark: (id: string, status: Mark): Write<"notification"> =>
		write(
			"notification",
			{ type: "mark", id, status },
			() => markNotificationAction(id, status),
			"Couldn't update notification.",
		),
	markAll: (status: Mark): Write<"notification"> =>
		write(
			"notification",
			{ type: "markAll", status },
			() => markAllNotificationsAction(status),
			"Couldn't update notifications.",
		),
};
