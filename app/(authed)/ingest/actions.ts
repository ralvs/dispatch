"use server";

import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { IngestLinkStatusSchema } from "@/lib/schemas/ingest-link";
import { setLinkStatus } from "@/lib/services/ingest-links";

export async function setLinkStatusAction(id: string, status: string) {
	const { sb } = await requireOwnerPage();
	await setLinkStatus(sb, z.uuid().parse(id), IngestLinkStatusSchema.parse(status));
	afterMutation("ingest.write");
}
