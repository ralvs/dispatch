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
