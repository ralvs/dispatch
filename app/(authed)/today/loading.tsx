import { TodaySkeleton } from "./today-skeleton";

/**
 * Route-level skeleton: the same silhouette as the page's own Suspense
 * fallback, minus the dateline — a loading.tsx renders before the page knows
 * the timezone, so the date is a bone here and real text one step later.
 */
export default function Loading() {
	return <TodaySkeleton />;
}
