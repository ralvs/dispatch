import { describe, expect, it } from "vitest";
import {
	applyIntent,
	applySeed,
	confirmWrite,
	initialState,
	rollbackWrite,
	selectAggregate,
	selectView,
} from "@/lib/store/core";
import { viewKey } from "@/lib/store/keys";
import { deepFreeze, NOW, note, snapshot, T1, T2, T3 } from "@/lib/store/test-fixtures";
import type { AnyIntent, StoreState } from "@/lib/store/types";

const key = viewKey.notes();
const flagged = note({ id: "flagged", needs_review: true, created_at: "2026-07-12T12:00:00.000Z" });
const older = note({ id: "older", created_at: "2026-07-01T12:00:00.000Z" });
const newer = note({ id: "newer", created_at: "2026-07-14T12:00:00.000Z" });

function seeded(readAt = T1): StoreState {
	return deepFreeze(
		applySeed(
			initialState(),
			snapshot(
				readAt,
				[{ key, type: "noteLists", data: { needsReview: [flagged], all: [newer, older] } }],
				{
					aggregates: { "notes.needsReview": 4 },
				},
			),
		),
	);
}

const intent = (i: AnyIntent["intent"]) => ({ kind: "note", intent: i }) as AnyIntent;
const lists = (s: StoreState) => {
	const v = selectView(s, key);
	return { review: v?.needsReview.map((n) => n.id), all: v?.all.map((n) => n.id) };
};

describe("note adapter", () => {
	it("a pin stamps the row at once; unpin clears it", () => {
		const [s1] = applyIntent(seeded(), intent({ type: "pin", id: "older", pinned: true }), NOW);
		expect(selectView(s1, key)?.all.find((n) => n.id === "older")?.pinned_at).toBe(NOW);
		const [s2] = applyIntent(s1, intent({ type: "pin", id: "older", pinned: false }), NOW);
		expect(selectView(s2, key)?.all.find((n) => n.id === "older")?.pinned_at).toBeNull();
	});

	it("filing a flagged note moves it into the list in order, and the count drops", () => {
		const [s1] = applyIntent(seeded(), intent({ type: "resolve", id: "flagged" }), NOW);
		expect(lists(s1)).toEqual({ review: [], all: ["newer", "flagged", "older"] });
		expect(selectAggregate(s1, "notes.needsReview")).toBe(3);
	});

	it("filing then deleting the same note moves the count once", () => {
		const [s1] = applyIntent(seeded(), intent({ type: "resolve", id: "flagged" }), NOW);
		const [s2] = applyIntent(s1, intent({ type: "delete", id: "flagged" }), NOW);
		expect(selectAggregate(s2, "notes.needsReview")).toBe(3);
		expect(lists(s2)).toEqual({ review: [], all: ["newer", "older"] });
	});

	it("deleting then filing the same note moves the count once", () => {
		const [s1] = applyIntent(seeded(), intent({ type: "delete", id: "flagged" }), NOW);
		const [s2] = applyIntent(s1, intent({ type: "resolve", id: "flagged" }), NOW);
		expect(selectAggregate(s2, "notes.needsReview")).toBe(3);
	});

	it("filing a note the store never loaded still moves the count, from what the user saw", () => {
		const s0 = deepFreeze(
			applySeed(initialState(), snapshot(T1, [], { aggregates: { "notes.needsReview": 2 } })),
		);
		const [s1] = applyIntent(s0, intent({ type: "resolve", id: "elsewhere", flagged: true }), NOW);
		expect(selectAggregate(s1, "notes.needsReview")).toBe(1);
		const [s2] = applyIntent(s0, intent({ type: "delete", id: "elsewhere", flagged: false }), NOW);
		expect(selectAggregate(s2, "notes.needsReview")).toBe(2);
	});

	it("a pin puts the note first in the list, newest pin first", () => {
		const [s1] = applyIntent(seeded(), intent({ type: "pin", id: "older", pinned: true }), NOW);
		expect(lists(s1).all).toEqual(["older", "newer"]);
		const [s2] = applyIntent(s1, intent({ type: "pin", id: "older", pinned: false }), NOW);
		expect(lists(s2).all).toEqual(["newer", "older"]);
	});

	it("a confirmed filing survives a stale seed; a fresher seed wins", () => {
		const [s1, t] = applyIntent(seeded(), intent({ type: "resolve", id: "flagged" }), NOW);
		const s2 = deepFreeze(
			confirmWrite(s1, t, { at: T2, rows: [{ ...flagged, needs_review: false }] }),
		);
		expect(
			lists(
				applySeed(
					s2,
					snapshot(T1, [
						{ key, type: "noteLists", data: { needsReview: [flagged], all: [newer, older] } },
					]),
				),
			),
		).toEqual({
			review: [],
			all: ["newer", "flagged", "older"],
		});
		// The sweep cron flagged it again after the write.
		expect(
			lists(
				applySeed(
					s2,
					snapshot(T3, [
						{ key, type: "noteLists", data: { needsReview: [flagged], all: [newer, older] } },
					]),
				),
			),
		).toEqual({
			review: ["flagged"],
			all: ["newer", "older"],
		});
	});

	it("a save's confirmed title shows in the list; a failure rolls back", () => {
		const [s1, t] = applyIntent(
			seeded(),
			intent({ type: "save", id: "older", title: "Renamed", body: "x" }),
			NOW,
		);
		expect(selectView(s1, key)?.all.find((n) => n.id === "older")?.title).toBe("Renamed");
		expect(selectView(rollbackWrite(s1, t), key)?.all.find((n) => n.id === "older")?.title).toBe(
			"older",
		);
	});

	it("a touch confirms the server's row with no optimistic change", () => {
		const [s1, t] = applyIntent(seeded(), intent({ type: "touch", id: "older" }), NOW);
		expect(selectView(s1, key)).toEqual(selectView(seeded(), key));
		const withFile = {
			...older,
			attachments: [
				{ url: "/f", storage_path: "p", name: "a.png", content_type: "image/png", size_bytes: 1 },
			],
		};
		const s2 = confirmWrite(s1, t, { at: T2, rows: [withFile] });
		expect(selectView(s2, key)?.all.find((n) => n.id === "older")?.attachments).toHaveLength(1);
	});

	it("a confirmed delete stays gone", () => {
		const [s1, t] = applyIntent(seeded(), intent({ type: "delete", id: "newer" }), NOW);
		const s2 = deepFreeze(confirmWrite(s1, t, { at: T2, rows: [], deletedIds: ["newer"] }));
		expect(
			lists(
				applySeed(
					s2,
					snapshot(T1, [
						{ key, type: "noteLists", data: { needsReview: [flagged], all: [newer, older] } },
					]),
				),
			),
		).toEqual({
			review: ["flagged"],
			all: ["older"],
		});
	});
});

describe("open note view", () => {
	const open = viewKey.note("older");
	const seedOpen = (s: StoreState, readAt = T1, row = older) =>
		applySeed(s, snapshot(readAt, [{ key: open, type: "openNote", data: [row] }]));
	const opened = (readAt = T1) => deepFreeze(seedOpen(initialState(), readAt));
	const row = (s: StoreState) => selectView(s, open)?.[0];

	it("a save changes title and body; its confirmation leaves the server's row", () => {
		const [s1, t] = applyIntent(
			opened(),
			intent({ type: "save", id: "older", title: "Renamed", body: "new body" }),
			NOW,
		);
		expect(row(s1)).toMatchObject({ title: "Renamed", body: "new body" });
		const server = { ...older, title: "Renamed", body: "new body" };
		expect(row(confirmWrite(s1, t, { at: T2, rows: [server] }))).toEqual(server);
	});

	it("filing sets the domain; a rollback restores it", () => {
		const [s1, t] = applyIntent(
			opened(),
			intent({ type: "file", id: "older", domainId: "d1" }),
			NOW,
		);
		expect(row(s1)?.domain_id).toBe("d1");
		expect(row(rollbackWrite(s1, t))?.domain_id).toBe(older.domain_id);
	});

	it("a resolve clears the flag and the row stays", () => {
		const s0 = deepFreeze(
			applySeed(
				initialState(),
				snapshot(T1, [{ key: viewKey.note("flagged"), type: "openNote", data: [flagged] }]),
			),
		);
		const [s1] = applyIntent(s0, intent({ type: "resolve", id: "flagged" }), NOW);
		const v = selectView(s1, viewKey.note("flagged"));
		expect(v).toHaveLength(1);
		expect(v?.[0].needs_review).toBe(false);
	});

	it("an adopted touch whose write carries new files shows them", () => {
		const [s1, t] = applyIntent(opened(), intent({ type: "touch", id: "older" }), NOW);
		const withFile = {
			...older,
			attachments: [
				{ url: "/f", storage_path: "p", name: "a.png", content_type: "image/png", size_bytes: 1 },
			],
		};
		expect(row(confirmWrite(s1, t, { at: T2, rows: [withFile] }))?.attachments).toHaveLength(1);
	});

	it("a delete empties the view; confirmed it stays empty; a rollback brings the row back", () => {
		const [s1, t] = applyIntent(opened(), intent({ type: "delete", id: "older" }), NOW);
		expect(selectView(s1, open)).toEqual([]);
		expect(
			selectView(confirmWrite(s1, t, { at: T2, rows: [], deletedIds: ["older"] }), open),
		).toEqual([]);
		expect(selectView(rollbackWrite(s1, t), open)?.map((n) => n.id)).toEqual(["older"]);
	});

	it("a create of another note and a confirmed write of another id keep the same view", () => {
		const s0 = opened();
		const before = selectView(s0, open);
		const [s1] = applyIntent(s0, intent({ type: "create", row: newer }), NOW);
		expect(selectView(s1, open)).toBe(before);
		const [s2, t] = applyIntent(s1, intent({ type: "touch", id: "newer" }), NOW);
		const s3 = confirmWrite(s2, t, { at: T2, rows: [{ ...newer, title: "Other" }] });
		expect(selectView(s3, open)).toBe(before);
	});

	it("a seed older than a confirmed save shows the saved body", () => {
		const [s1, t] = applyIntent(
			opened(),
			intent({ type: "save", id: "older", title: "Saved", body: "saved body" }),
			NOW,
		);
		const s2 = deepFreeze(
			confirmWrite(s1, t, { at: T2, rows: [{ ...older, title: "Saved", body: "saved body" }] }),
		);
		expect(row(seedOpen(s2, T1))?.body).toBe("saved body");
	});

	it("one filing moves the /notes lists and the open note together", () => {
		const s0 = deepFreeze(seedOpen(seeded()));
		const [s1] = applyIntent(s0, intent({ type: "file", id: "older", domainId: "d1" }), NOW);
		expect(row(s1)?.domain_id).toBe("d1");
		expect(selectView(s1, key)?.all.find((n) => n.id === "older")?.domain_id).toBe("d1");
	});
});
