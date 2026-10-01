import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEntryAction } from "@/app/(authed)/journal/actions";
import type { ActionResult } from "@/lib/action-result";
import type { JournalEntryRow } from "@/lib/schemas/journal";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { journalEntry, NOW, snapshot, T1, T2, TODAY } from "@/lib/store/test-fixtures";
import type { StoreWrite } from "@/lib/store/types";
import { getMeasure } from "@/test/component/measure";
import { JournalList } from "./journal-list";

vi.mock("@/app/(authed)/journal/actions", () => ({
	createEntryAction: vi.fn(),
	deleteEntryAction: vi.fn(),
}));
vi.mock("@/lib/client/toast", () => ({ toastError: vi.fn() }));

type Result = ActionResult<StoreWrite<JournalEntryRow>>;

const yesterday = journalEntry({ id: "y", transcription_text: "Rained all day" });

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
});

function renderList() {
	const snap = snapshot(T1, [
		{ key: viewKey.journal(), type: "journalList", data: { rows: [yesterday] } },
	]);
	render(
		<StoreProvider store={store}>
			<Seed snapshot={snap}>
				<JournalList />
			</Seed>
		</StoreProvider>,
	);
}

describe("JournalList on the entity store", () => {
	it("a new entry lands under today's group at once, and the server's row confirms it", async () => {
		let resolve: (r: Result) => void = () => {};
		vi.mocked(createEntryAction).mockReturnValue(
			new Promise<Result>((r) => {
				resolve = r;
			}),
		);
		const user = userEvent.setup();
		renderList();
		expect(getMeasure(1, "entry")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "+ New entry" }));
		await user.type(screen.getByLabelText("Journal entry"), "Shipped the store");
		await user.click(screen.getByRole("button", { name: "Save entry" }));

		expect(getMeasure(2, "entries")).toBeInTheDocument();
		const groups = screen.getAllByRole("listitem");
		expect(within(groups[0]).getByText("Shipped the store")).toBeInTheDocument();

		const saved = journalEntry({
			id: "saved",
			entry_date: TODAY,
			transcription_text: "Shipped the store",
			created_at: "2026-07-15T12:02:31+00:00",
		});
		await act(async () => resolve({ ok: true, data: { at: T2, rows: [saved] } }));
		expect(screen.getAllByText("Shipped the store")).toHaveLength(1);
		expect(store.getState().pending).toEqual([]);
	});
});
