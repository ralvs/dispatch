import { describe, expect, it } from "vitest";
import {
	applyIntent,
	applySeed,
	confirmWrite,
	initialState,
	rollbackWrite,
	selectView,
} from "@/lib/store/core";
import { viewKey } from "@/lib/store/keys";
import {
	deepFreeze,
	journalEntry,
	link,
	NOW,
	quote,
	snapshot,
	T1,
	T2,
	T3,
} from "@/lib/store/test-fixtures";
import type { AnyIntent, StoreState } from "@/lib/store/types";

// The record factory (#30) through the store core, on the three kinds that
// show its three options: quotes (order), journal (two-key order), links
// (unlisted rows and no admission).

const quotes = viewKey.quotes();
const journal = viewKey.journal();
const links = viewKey.links();

const older = quote({ id: "older", created_at: "2026-07-01T12:00:00+00:00" });
const newer = quote({ id: "newer", created_at: "2026-07-09T12:00:00+00:00" });

function seededQuotes(readAt = T1, rows = [newer, older]): StoreState {
	return deepFreeze(
		applySeed(
			initialState(),
			snapshot(readAt, [{ key: quotes, type: "quoteList", data: { rows } }]),
		),
	);
}

const ids = (rows: { id: string }[] | undefined) => rows?.map((r) => r.id);

describe("record views", () => {
	it("a create shows at once in its place; the server's row replaces the provisional one", () => {
		const draft = quote({ id: "tmp", created_at: "2026-07-15T12:02:30.000Z" });
		const [s1, t] = applyIntent(
			seededQuotes(),
			{ kind: "quote", intent: { type: "create", row: draft } },
			NOW,
		);
		expect(ids(selectView(s1, quotes))).toEqual(["tmp", "newer", "older"]);

		const saved = quote({ id: "saved", created_at: "2026-07-15T12:02:31+00:00" });
		const s2 = confirmWrite(s1, t, { at: T2, rows: [saved] });
		expect(ids(selectView(s2, quotes))).toEqual(["saved", "newer", "older"]);
	});

	it("a rejected create leaves nothing behind", () => {
		const [s1, t] = applyIntent(
			seededQuotes(),
			{ kind: "quote", intent: { type: "create", row: quote({ id: "tmp" }) } },
			NOW,
		);
		expect(selectView(rollbackWrite(s1, t), quotes)).toEqual([newer, older]);
	});

	it("a confirmed create survives a stale seed and yields to a fresher one", () => {
		const saved = quote({ id: "saved", created_at: "2026-07-15T12:02:31+00:00" });
		const [s1, t] = applyIntent(
			seededQuotes(),
			{ kind: "quote", intent: { type: "create", row: quote({ id: "tmp" }) } },
			NOW,
		);
		const s2 = confirmWrite(s1, t, { at: T2, rows: [saved] });

		// A router-cache replay read before the write: the row stays.
		const stale = applySeed(
			s2,
			snapshot(T1, [{ key: quotes, type: "quoteList", data: { rows: [newer, older] } }]),
		);
		expect(ids(selectView(stale, quotes))).toEqual(["saved", "newer", "older"]);
		// A read after the write is the truth — here, someone deleted it since.
		const fresh = applySeed(
			s2,
			snapshot(T3, [{ key: quotes, type: "quoteList", data: { rows: [newer, older] } }]),
		);
		expect(ids(selectView(fresh, quotes))).toEqual(["newer", "older"]);
	});

	it("a delete leaves at once, and its tombstone outlasts a stale seed", () => {
		const [s1, t] = applyIntent(
			seededQuotes(),
			{ kind: "quote", intent: { type: "delete", id: "older" } },
			NOW,
		);
		expect(ids(selectView(s1, quotes))).toEqual(["newer"]);
		const s2 = confirmWrite(s1, t, { at: T2, rows: [], deletedIds: ["older"] });
		const stale = applySeed(
			s2,
			snapshot(T1, [{ key: quotes, type: "quoteList", data: { rows: [newer, older] } }]),
		);
		expect(ids(selectView(stale, quotes))).toEqual(["newer"]);
	});

	it("orders journal entries by day, then newest within the day", () => {
		const mon = journalEntry({ id: "mon", entry_date: "2026-07-13" });
		const tueEarly = journalEntry({
			id: "tue-early",
			entry_date: "2026-07-14",
			created_at: "2026-07-14T09:00:00+00:00",
		});
		const s0 = applySeed(
			initialState(),
			snapshot(T1, [{ key: journal, type: "journalList", data: { rows: [tueEarly, mon] } }]),
		);
		const late = journalEntry({
			id: "tue-late",
			entry_date: "2026-07-14",
			created_at: "2026-07-15T12:02:30.000Z",
		});
		const backdated = journalEntry({ id: "sun", entry_date: "2026-07-12" });
		let s = s0;
		for (const row of [late, backdated]) {
			[s] = applyIntent(s, { kind: "journal", intent: { type: "create", row } }, NOW);
		}
		expect(ids(selectView(s, journal))).toEqual(["tue-late", "tue-early", "mon", "sun"]);
	});

	it("a patch that unlists a row drops it; one that keeps it listed edits in place", () => {
		const a = link({ id: "a" });
		const b = link({ id: "b", status: "read", created_at: "2026-07-01T12:00:00+00:00" });
		const s0 = applySeed(
			initialState(),
			snapshot(T1, [{ key: links, type: "linkList", data: { rows: [a, b] } }]),
		);
		const [s1] = applyIntent(
			s0,
			{ kind: "link", intent: { type: "patch", id: "a", patch: { status: "read" } } },
			NOW,
		);
		expect(selectView(s1, links)?.map((l) => `${l.id}:${l.status}`)).toEqual(["a:read", "b:read"]);
		const [s2] = applyIntent(
			s1,
			{ kind: "link", intent: { type: "patch", id: "b", patch: { status: "dismissed" } } },
			NOW,
		);
		expect(ids(selectView(s2, links))).toEqual(["a"]);
	});

	it("a dismissed link the seed still lists never shows; a link the list never held is not admitted", () => {
		const gone = link({ id: "gone", status: "dismissed" });
		const s0 = applySeed(
			initialState(),
			snapshot(T1, [{ key: links, type: "linkList", data: { rows: [link({ id: "a" }), gone] } }]),
		);
		expect(ids(selectView(s0, links))).toEqual(["a"]);

		const [s1, t] = applyIntent(
			s0,
			{ kind: "link", intent: { type: "patch", id: "far", patch: { status: "read" } } },
			NOW,
		);
		const s2 = confirmWrite(s1, t, { at: T2, rows: [link({ id: "far", status: "read" })] });
		expect(ids(selectView(s2, links))).toEqual(["a"]);
	});

	it("a replayed write changes nothing", () => {
		const intent = { kind: "quote", intent: { type: "delete", id: "older" } } as AnyIntent;
		const [s1] = applyIntent(seededQuotes(), intent, NOW);
		const [s2] = applyIntent(s1, intent, NOW);
		expect(selectView(s2, quotes)).toEqual(selectView(s1, quotes));
	});
});
