import { act, render, screen } from "@testing-library/react";
import { Activity } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { NOW, note, snapshot, T1, T2 } from "@/lib/store/test-fixtures";
import { useOpenNote } from "./use-open-note";

const ID = "n1";
const opened = note({ id: ID, title: "Plan", body: "Some body" });
const seedSnap = snapshot(T1, [{ key: viewKey.note(ID), type: "openNote", data: [opened] }]);

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
});

function Probe({ noteId }: { noteId: string }) {
	const row = useOpenNote(noteId);
	return <p>{row ? row.title : "gone"}</p>;
}

// Next hides a page it leaves (an Activity), which runs its effect cleanups.
function Page({ noteId, mode }: { noteId: string; mode: "visible" | "hidden" }) {
	return (
		<StoreProvider store={store}>
			<Seed snapshot={seedSnap}>
				<Activity mode={mode}>
					<Probe noteId={noteId} />
				</Activity>
			</Seed>
		</StoreProvider>
	);
}

describe("useOpenNote", () => {
	it("holds a deleted note until the page is hidden, then shows it gone", () => {
		const { rerender } = render(<Page noteId={ID} mode="visible" />);
		expect(screen.getByText("Plan")).toBeInTheDocument();

		act(() => {
			const t = store.getState().apply({ kind: "note", intent: { type: "delete", id: ID } });
			store.getState().confirm(t, { at: T2, rows: [], deletedIds: [ID] });
		});
		expect(screen.getByText("Plan")).toBeInTheDocument();

		rerender(<Page noteId={ID} mode="hidden" />);
		rerender(<Page noteId={ID} mode="visible" />);
		expect(screen.getByText("gone")).toBeInTheDocument();
	});

	it("never falls back to another note's row", () => {
		const { rerender } = render(<Page noteId={ID} mode="visible" />);
		expect(screen.getByText("Plan")).toBeInTheDocument();

		rerender(<Page noteId="n2" mode="visible" />);
		expect(screen.getByText("gone")).toBeInTheDocument();
	});
});
