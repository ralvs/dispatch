// The link kind (#30). Links arrive from outside the app (a URL posted to
// /api/capture), so new rows come only through seeds; the client only sets a
// row's status. A status is desired state, so a replay is idempotent. A
// dismissed link leaves the reading list for good.

import type { LinkRow } from "@/lib/schemas/link";
import {
	newestFirst,
	type RecordIntent,
	recordKind,
	recordListView,
} from "@/lib/store/kinds/record";
import type { KindAdapter, ViewAdapter } from "@/lib/store/types";

export type LinkIntent = RecordIntent<LinkRow>;

export const linkKind: KindAdapter<"link"> = recordKind<LinkRow>();

export const linkListView: ViewAdapter<"linkList"> = {
	kind: "link",
	...recordListView<LinkRow>({
		listed: (l) => l.status !== "dismissed",
		// The client creates none, and a write can carry a row older than the
		// 200 the list holds.
		belongs: () => false,
		compare: newestFirst((l) => l.created_at),
	}),
};
