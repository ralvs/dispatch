// What a ledger row asks of the owner (docs/adr/0080). The table has no
// severity column: `type` is the classifier, so the split is read from it.
//
//   alert     something failed and is waiting on the owner. Lands unread,
//             sorts to the top of /notifications, and is what Today counts.
//   activity  a record of something that worked (a capture filed, a reminder
//             fired). Its push is the delivery; the row lands already read.
//
// An unknown type is activity: a new writer must opt in to interrupting.

export type NotificationKind = "alert" | "activity";

/** Types that are alerts without a `failed` suffix. */
const ALERT_TYPES: ReadonlySet<string> = new Set([
	// The sweep degraded captures that got stuck on their way in.
	"cron.sweep",
]);

export function notificationKind(type: string): NotificationKind {
	// `gcal.sync_failed`, and any `*.failed` a later writer adds.
	if (type.endsWith("failed") || ALERT_TYPES.has(type)) return "alert";
	return "activity";
}
