"use server";

import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { markNotification } from "@/lib/services/notifications";

export async function markNotificationAction(id: string, status: "read" | "dismissed") {
	const { sb } = await requireOwnerPage();
	await markNotification(sb, z.uuid().parse(id), z.enum(["read", "dismissed"]).parse(status));
	afterMutation("notification.write");
}
