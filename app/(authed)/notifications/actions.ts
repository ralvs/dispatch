"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { markNotification } from "@/lib/services/notifications";

function revalidateNotificationViews() {
	revalidatePath("/notifications");
	// The Today masthead shows the unread badge.
	revalidatePath("/today");
}

export async function markNotificationAction(id: string, status: "read" | "dismissed") {
	const { sb } = await requireOwnerPage();
	await markNotification(sb, z.uuid().parse(id), z.enum(["read", "dismissed"]).parse(status));
	revalidateNotificationViews();
}
