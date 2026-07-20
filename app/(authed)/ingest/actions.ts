"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { IngestLinkStatusSchema } from "@/lib/schemas/ingest-link";
import { setLinkStatus } from "@/lib/services/ingest-links";

function revalidateIngestViews() {
	revalidatePath("/ingest");
	// Today's alerts row carries the unread count.
	revalidatePath("/today");
}

export async function setLinkStatusAction(id: string, status: string) {
	const { sb } = await requireOwnerPage();
	await setLinkStatus(sb, z.uuid().parse(id), IngestLinkStatusSchema.parse(status));
	revalidateIngestViews();
}
