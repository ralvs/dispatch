import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { removeAttachmentAction } from "@/app/(authed)/notes/actions";
import { toastError } from "@/lib/client/toast";
import type { Attachment } from "@/lib/schemas/note";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { NOW, note, snapshot, T1, T2 } from "@/lib/store/test-fixtures";
import { router } from "@/test/component/navigation";
import { AttachmentStrip } from "./attachment-strip";

vi.mock("@/app/(authed)/notes/actions", () => ({
	setPinAction: vi.fn(),
	saveNoteAction: vi.fn(),
	setNoteDomainAction: vi.fn(),
	resolveNeedsReviewAction: vi.fn(),
	deleteNoteAction: vi.fn(),
	removeAttachmentAction: vi.fn(),
}));
vi.mock("@/lib/client/toast", () => ({ toastError: vi.fn() }));

const ID = "n1";
const file = (name: string): Attachment => ({
	url: `/f/${name}`,
	storage_path: `p/${name}`,
	name,
	content_type: "application/pdf",
	size_bytes: 10,
});
const seeded = note({ id: ID, attachments: [file("a.pdf")] });

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
	vi.clearAllMocks();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

function renderStrip() {
	render(
		<StoreProvider store={store}>
			<Seed snapshot={snapshot(T1, [{ key: viewKey.note(ID), type: "openNote", data: [seeded] }])}>
				<AttachmentStrip noteId={ID}>
					<p>editor</p>
				</AttachmentStrip>
			</Seed>
		</StoreProvider>,
	);
}

describe("AttachmentStrip on the entity store", () => {
	it("shows the note's seeded files", () => {
		renderStrip();
		expect(screen.getByRole("link", { name: "a.pdf" })).toBeInTheDocument();
	});

	it("an upload's write shows the new file, with no page refresh", async () => {
		const added = { ...seeded, attachments: [file("a.pdf"), file("b.pdf")] };
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response(
						JSON.stringify({ attached: [file("b.pdf")], write: { at: T2, rows: [added] } }),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				),
		);
		const user = userEvent.setup();
		renderStrip();

		await user.upload(
			screen.getByLabelText("Add files to this note"),
			new File(["x"], "b.pdf", { type: "application/pdf" }),
		);
		expect(await screen.findByRole("link", { name: "b.pdf" })).toBeInTheDocument();
		expect(router.refresh).not.toHaveBeenCalled();
	});

	it("a removal takes the file away once the server confirms", async () => {
		vi.mocked(removeAttachmentAction).mockResolvedValue({
			ok: true,
			data: { at: T2, rows: [{ ...seeded, attachments: [] }] },
		});
		const user = userEvent.setup();
		renderStrip();

		await user.click(screen.getByRole("button", { name: "Remove a.pdf" }));
		expect(removeAttachmentAction).toHaveBeenCalledWith(ID, "p/a.pdf");
		await waitFor(() => expect(screen.queryByRole("link", { name: "a.pdf" })).toBeNull());
	});

	it("a failed removal keeps the file and says so", async () => {
		vi.mocked(removeAttachmentAction).mockRejectedValue(new Error("down"));
		const user = userEvent.setup();
		renderStrip();

		await user.click(screen.getByRole("button", { name: "Remove a.pdf" }));
		await waitFor(() => expect(toastError).toHaveBeenCalledWith("Couldn't remove the file."));
		expect(screen.getByRole("link", { name: "a.pdf" })).toBeInTheDocument();
	});
});
