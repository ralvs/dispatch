import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	deleteNoteAction,
	resolveNeedsReviewAction,
	saveNoteAction,
	setNoteDomainAction,
} from "@/app/(authed)/notes/actions";
import { toastError, toastSuccess } from "@/lib/client/toast";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { NOW, note, snapshot, T1, T2 } from "@/lib/store/test-fixtures";
import { router } from "@/test/component/navigation";
import { NoteEditor } from "./note-editor";

vi.mock("@tiptap/react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tiptap/react")>()),
	useEditor: () => null,
	EditorContent: () => null,
}));
vi.mock("@/app/(authed)/notes/actions", () => ({
	setPinAction: vi.fn(),
	saveNoteAction: vi.fn(),
	setNoteDomainAction: vi.fn(),
	resolveNeedsReviewAction: vi.fn(),
	deleteNoteAction: vi.fn(),
	removeAttachmentAction: vi.fn(),
}));
vi.mock("@/lib/client/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

const ID = "n1";
const opened = note({ id: ID, title: "Plan", body: "Some body", needs_review: true });
const domains = [{ id: "d1", name: "Work" }];

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
	vi.clearAllMocks();
});

const seedSnap = () =>
	snapshot(T1, [
		{ key: viewKey.notes(), type: "noteLists", data: { needsReview: [opened], all: [] } },
		{ key: viewKey.note(ID), type: "openNote", data: [opened] },
	]);

function renderEditor() {
	render(
		<StoreProvider store={store}>
			<Seed snapshot={seedSnap()}>
				<NoteEditor noteId={ID} noteTitles={[]} domains={domains} />
			</Seed>
		</StoreProvider>,
	);
}

describe("NoteEditor on the entity store", () => {
	it("filing shows the new domain at once, and on /notes", async () => {
		vi.mocked(setNoteDomainAction).mockResolvedValue({
			ok: true,
			data: { at: T2, rows: [{ ...opened, domain_id: "d1" }] },
		});
		const user = userEvent.setup();
		renderEditor();

		await user.selectOptions(screen.getByLabelText("Domain"), "d1");
		expect(screen.getByLabelText("Domain")).toHaveValue("d1");
		const lists = store.getState().views[viewKey.notes()]?.base as {
			needsReview: { domain_id: string | null }[];
		};
		expect(lists.needsReview[0].domain_id).toBe("d1");
	});

	it("the autosave confirms without a toast", async () => {
		vi.mocked(saveNoteAction).mockResolvedValue({
			ok: true,
			data: { at: T2, rows: [{ ...opened, title: "Plan B" }] },
		});
		const user = userEvent.setup();
		renderEditor();

		await user.type(screen.getByLabelText("Note title"), " B");
		await user.tab();
		await waitFor(() => expect(saveNoteAction).toHaveBeenCalled());
		await waitFor(() => expect(screen.getByText(/Saved/)).toBeInTheDocument());
		expect(toastSuccess).not.toHaveBeenCalled();
	});

	it("a rejected filing restores the select and says so", async () => {
		vi.mocked(setNoteDomainAction).mockRejectedValue(new Error("down"));
		const user = userEvent.setup();
		renderEditor();

		await user.selectOptions(screen.getByLabelText("Domain"), "d1");
		await waitFor(() => expect(toastError).toHaveBeenCalledWith("Couldn't file this note."));
		expect(screen.getByLabelText("Domain")).toHaveValue("");
	});

	it("Resolve hides at once and comes back on failure", async () => {
		let reject: (e: Error) => void = () => {};
		vi.mocked(resolveNeedsReviewAction).mockReturnValue(
			new Promise((_, r) => {
				reject = r;
			}),
		);
		const user = userEvent.setup();
		renderEditor();

		await user.click(screen.getByRole("button", { name: "Resolve needs-review flag" }));
		expect(screen.queryByRole("button", { name: "Resolve needs-review flag" })).toBeNull();
		reject(new Error("down"));
		expect(
			await screen.findByRole("button", { name: "Resolve needs-review flag" }),
		).toBeInTheDocument();
	});

	it("delete keeps the note on screen and goes to /notes", async () => {
		vi.mocked(deleteNoteAction).mockResolvedValue({
			ok: true,
			data: { at: T2, rows: [], deletedIds: [ID] },
		});
		const user = userEvent.setup();
		renderEditor();

		await user.click(screen.getByRole("button", { name: "Delete note" }));
		await waitFor(() => expect(router.push).toHaveBeenCalledWith("/notes"));
		expect(screen.getByLabelText("Note title")).toBeInTheDocument();
		expect(screen.queryByText(/This note is gone/)).toBeNull();
	});

	it("a note deleted before the page renders shows it gone", () => {
		store.getState().seed(seedSnap());
		const t = store.getState().apply({ kind: "note", intent: { type: "delete", id: ID } });
		store.getState().confirm(t, { at: T2, rows: [], deletedIds: [ID] });
		renderEditor();

		expect(screen.getByText(/This note is gone/)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Back to Notes" })).toHaveAttribute("href", "/notes");
	});

	it("a save confirmed after the seed's read opens with the saved title", () => {
		store.getState().seed(seedSnap());
		const t = store.getState().apply({
			kind: "note",
			intent: { type: "save", id: ID, title: "Saved title", body: "Saved body" },
		});
		store.getState().confirm(t, {
			at: T2,
			rows: [{ ...opened, title: "Saved title", body: "Saved body" }],
		});
		renderEditor();

		expect(screen.getByLabelText("Note title")).toHaveValue("Saved title");
	});
});
