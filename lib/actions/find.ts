"use server";

import { requireOwnerPage } from "@/lib/auth";
import { type FindResult, find } from "@/lib/services/find";

export async function findAction(query: string): Promise<FindResult> {
	const { sb } = await requireOwnerPage();
	return find(sb, query);
}
