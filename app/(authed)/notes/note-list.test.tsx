import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setPinAction } from "@/app/(authed)/notes/actions";
import type { ActionResult } from "@/lib/action-result";
import { toastError } from "@/lib/client/toast";
import type { NoteListRow } from "@/lib/schemas/note";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { NOW, note, snapshot, T1, T2, TZ } from "@/lib/store/test-fixtures";
import type { StoreWrite } from "@/lib/store/types";
import { NoteList } from "./note-list";

vi.mock("@/app/(authed)/notes/actions", () => ({
	setPinAction: vi.fn(),
	createBlankNoteAction: vi.fn(),
}));
vi.mock("@/lib/client/toast", () => ({ toastError: vi.fn() }));

type Result = ActionResult<StoreWrite<NoteListRow>>;

const idea = note({ id: "idea", title: "An idea" });
const flagged = note({ id: "flagged", title: "Unplaced", needs_review: true });

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
});

function renderList() {
	const snap = snapshot(T1, [
		{ key: viewKey.notes(), type: "noteLists", data: { needsReview: [flagged], all: [idea] } },
	]);
	render(
		<StoreProvider store={store}>
			<Seed snapshot={snap}>
				<NoteList tz={TZ} domains={[]} />
			</Seed>
		</StoreProvider>,
	);
}

function deferred() {
	let resolve: (r: Result) => void = () => {};
	const promise = new Promise<Result>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

const section = (name: string) => screen.getByRole("region", { name });

describe("NoteList on the entity store", () => {
	it("a pin moves the note to Pinned at once, and the server's row keeps it there", async () => {
		const action = deferred();
		vi.mocked(setPinAction).mockReturnValue(action.promise);
		const user = userEvent.setup();
		renderList();

		await user.click(within(section("All notes")).getByRole("button", { name: "Pin note" }));
		expect(setPinAction).toHaveBeenCalledWith({ id: "idea", pinned: true });
		expect(within(section("Pinned")).getByText("An idea")).toBeInTheDocument();

		const pinned = { ...idea, pinned_at: T2 };
		await act(async () => action.resolve({ ok: true, data: { at: T2, rows: [pinned] } }));
		expect(within(section("Pinned")).getByText("An idea")).toBeInTheDocument();
		expect(store.getState().pending).toEqual([]);
	});

	it("a failed pin puts the note back and says so", async () => {
		const action = deferred();
		vi.mocked(setPinAction).mockReturnValue(action.promise);
		const user = userEvent.setup();
		renderList();

		await user.click(within(section("All notes")).getByRole("button", { name: "Pin note" }));
		await act(async () => action.resolve({ ok: false, formError: "Couldn't update pin." }));
		expect(within(section("All notes")).getByText("An idea")).toBeInTheDocument();
		expect(toastError).toHaveBeenCalledWith("Couldn't update pin.");
	});

	it("the header counts the notes and the ones that need review", () => {
		renderList();
		expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
		expect(screen.getByText("need review")).toBeInTheDocument();
	});
});
