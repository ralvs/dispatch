"use server";

import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { LinkStatusSchema } from "@/lib/schemas/link";
import { setLinkStatus } from "@/lib/services/links";

export async function setLinkStatusAction(id: string, status: string) {
	const { sb } = await requireOwnerPage();
	await setLinkStatus(sb, z.uuid().parse(id), LinkStatusSchema.parse(status));
	afterMutation("links.write");
}
