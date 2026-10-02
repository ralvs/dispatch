"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { afterMutation } from "@/lib/invalidate";
import { type LinkRow, LinkStatusSchema } from "@/lib/schemas/link";
import { setLinkStatus } from "@/lib/services/links";
import { stampWrite } from "@/lib/store/server";
import type { StoreWrite } from "@/lib/store/types";

/**
 * Set a link's read state, and return the row for the entity store to confirm
 * from (#30). A link that is gone comes back as a deleted id.
 */
export async function setLinkStatusAction(
	id: string,
	status: string,
): Promise<ActionResult<StoreWrite<LinkRow>>> {
	const { sb } = await requireOwnerPage();
	const linkId = z.uuid().parse(id);
	const row = await setLinkStatus(sb, linkId, LinkStatusSchema.parse(status));
	afterMutation("links.write");
	return { ok: true, data: row ? stampWrite([row]) : stampWrite([], [linkId]) };
}
