// The quote kind (#30). /quotes lists every quote, newest first (listQuotes).
// No `updated_at`: an edit is a desired-state patch (./record.ts).

import type { QuoteRow } from "@/lib/schemas/quote";
import {
	newestFirst,
	type RecordIntent,
	recordKind,
	recordListView,
} from "@/lib/store/kinds/record";
import type { KindAdapter, ViewAdapter } from "@/lib/store/types";

export type QuoteIntent = RecordIntent<QuoteRow>;

export const quoteKind: KindAdapter<"quote"> = recordKind<QuoteRow>();

export const quoteListView: ViewAdapter<"quoteList"> = {
	kind: "quote",
	...recordListView<QuoteRow>({ compare: newestFirst((q) => q.created_at) }),
};
