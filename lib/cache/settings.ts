import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CacheTag } from "@/lib/cache/tags";
import { getAppTimezone } from "@/lib/services/settings";
import { createAdminClient } from "@/lib/supabase/admin";

/** App timezone rarely changes — cache hard, invalidate on settings.timezone. */
export async function getCachedAppTimezone(): Promise<string> {
	"use cache";
	cacheTag(CacheTag.settings);
	cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
	return getAppTimezone(createAdminClient());
}
