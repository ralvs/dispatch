// The domain kind (#30). A row is a DomainItem — the domain with its cadence
// rule and last touch, both server-derived — so every write answers with the
// whole item, and the stat band on /domains is computed from store rows.
// /domains lists active domains first, then by name (listDomains).

import type { DomainItem } from "@/lib/schemas/domain";
import { type RecordIntent, recordKind, recordListView } from "@/lib/store/kinds/record";
import type { KindAdapter, ViewAdapter } from "@/lib/store/types";

export type DomainIntent = RecordIntent<DomainItem>;

export const domainKind: KindAdapter<"domain"> = recordKind<DomainItem>();

function activeThenName(a: DomainItem, b: DomainItem): number {
	if (a.active !== b.active) return a.active ? -1 : 1;
	return a.name.localeCompare(b.name);
}

export const domainListView: ViewAdapter<"domainList"> = {
	kind: "domain",
	...recordListView<DomainItem>({ compare: activeThenName }),
};
